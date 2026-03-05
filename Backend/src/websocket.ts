  import { Server as SocketIOServer, Socket } from "socket.io";
  import { Server as HTTPServer } from "http";
  import { pool } from "./db";

  // FILE PATH: src/websocket.ts

  interface AuthenticatedSocket extends Socket {
    userId?: number;
    userEmail?: string;
  }

  // Store active user connections
  const userSockets = new Map<number, Set<string>>();

  async function canUsersMessageEachOther(senderId: number, recipientId: number): Promise<boolean> {
    if (!senderId || !recipientId || senderId === recipientId) {
      return false;
    }

    const result = await pool.query(
      `SELECT 1
      FROM users sender_user
      JOIN users recipient_user ON recipient_user.id = $2
      JOIN reservations r
        ON r.status = 'approved'
        AND r.tenant_action = 'accepted'
      WHERE sender_user.id = $1
        AND (
          (
            r.dorm_owner_id = $1
            AND lower(trim(coalesce(recipient_user.full_name, ''))) = lower(trim(coalesce(r.full_name, '')))
          )
          OR
          (
            r.dorm_owner_id = $2
            AND lower(trim(coalesce(sender_user.full_name, ''))) = lower(trim(coalesce(r.full_name, '')))
          )
        )
      LIMIT 1`,
      [senderId, recipientId]
    );

    return result.rows.length > 0;
  }

  export function initializeWebSocket(httpServer: HTTPServer) {
    const io = new SocketIOServer(httpServer, {
      cors: {
        // ── UPDATED: allows Android (no origin header) + web clients ──────────
        origin: (origin, callback) => {
          const allowed = ['http://localhost:5173', 'http://localhost:5176'];
          // Allow whitelisted web origins OR no origin (Android / mobile apps)
          if (!origin || allowed.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error(`CORS blocked: ${origin}`));
          }
        },
        // ── END UPDATE ────────────────────────────────────────────────────────
        credentials: true,
      },
    });

    // Authentication middleware
    io.use(async (socket: AuthenticatedSocket, next) => {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
      
      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      try {
        // Verify token from database
        const result = await pool.query(
          `SELECT user_id, email FROM sessions 
          JOIN users ON sessions.user_id = users.id 
          WHERE token = $1 AND expires_at > NOW()`,
          [token]
        );

        if (result.rows.length === 0) {
          return next(new Error("Authentication error: Invalid or expired token"));
        }

        socket.userId = result.rows[0].user_id;
        socket.userEmail = result.rows[0].email;
        next();
      } catch (error) {
        console.error("WebSocket auth error:", error);
        next(new Error("Authentication error"));
      }
    });

    io.on("connection", (socket: AuthenticatedSocket) => {
      const userId = socket.userId!;
      console.log(`✅ User ${userId} connected via WebSocket (${socket.id})`);

      // Track user connection
      if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
      }
      userSockets.get(userId)!.add(socket.id);

      // Join user's personal room
      socket.join(`user:${userId}`);

      // Handle chat message
      socket.on("send_message", async (data: { recipientId: number; message: string }) => {
        try {
          const { recipientId, message } = data;
          const trimmedMessage = String(message || "").trim();

          if (!recipientId || !trimmedMessage) {
            socket.emit("error", { message: "Invalid recipient or empty message" });
            return;
          }

          const allowed = await canUsersMessageEachOther(userId, Number(recipientId));
          if (!allowed) {
            socket.emit("error", {
              message: "You can only message users currently occupying your dorm (or your dorm owner).",
            });
            return;
          }

          const persisted = await pool.query(
            `INSERT INTO messages (sender_id, recipient_id, message, created_at)
             VALUES ($1, $2, $3, NOW())
             RETURNING id, created_at`,
            [userId, Number(recipientId), trimmedMessage]
          );

          const row = persisted.rows[0];
          const messageId = Number(row.id);
          const timestamp = row.created_at instanceof Date
            ? row.created_at.toISOString()
            : new Date(row.created_at).toISOString();

          // Emit to recipient
          io.to(`user:${recipientId}`).emit("new_message", {
            id: messageId,
            senderId: userId,
            recipientId: Number(recipientId),
            senderEmail: socket.userEmail,
            message: trimmedMessage,
            timestamp,
          });

          // Confirm to sender
          socket.emit("message_sent", {
            id: messageId,
            senderId: userId,
            recipientId,
            message: trimmedMessage,
            timestamp,
          });
        } catch (error) {
          console.error("Error sending message:", error);
          socket.emit("error", { message: "Failed to send message" });
        }
      });

      // Handle typing indicator
      socket.on("typing", (data: { recipientId: number; isTyping: boolean }) => {
        io.to(`user:${data.recipientId}`).emit("user_typing", {
          userId,
          isTyping: data.isTyping,
        });
      });

      // Handle disconnect
      socket.on("disconnect", () => {
        console.log(`❌ User ${userId} disconnected (${socket.id})`);
        
        const sockets = userSockets.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            userSockets.delete(userId);
          }
        }
      });
    });

    return io;
  }

  // Utility functions to emit events from API routes
  export function getSocketIO(httpServer: HTTPServer): SocketIOServer | null {
    // @ts-ignore - Socket.IO attaches itself to the server
    return httpServer._socketio || null;
  }

  export function notifyUser(io: SocketIOServer, userId: number, event: string, data: any) {
    io.to(`user:${userId}`).emit(event, data);
  }

  export function notifyMultipleUsers(io: SocketIOServer, userIds: number[], event: string, data: any) {
    userIds.forEach(userId => {
      io.to(`user:${userId}`).emit(event, data);
    });
  }

  export { userSockets };