import express from "express";
import * as dotenv from "dotenv";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { pool } from "./db";

dotenv.config();

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const DORMS_PHOTOS_DIR = path.join(UPLOAD_DIR, "dorms");
if (!fs.existsSync(DORMS_PHOTOS_DIR)) {
  fs.mkdirSync(DORMS_PHOTOS_DIR, { recursive: true });
}

const SESSION_MINUTES = 5;

function createSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

async function createSession(userId: number): Promise<string> {
  const token = createSessionToken();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + SESSION_MINUTES);
  await pool.query(
    "INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)",
    [userId, token, expiresAt]
  );
  return token;
}

async function getUserIdFromToken(req: express.Request): Promise<number | null> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const result = await pool.query(
    "SELECT user_id FROM sessions WHERE token = $1 AND expires_at > current_timestamp",
    [token]
  );
  return result.rows.length > 0 ? result.rows[0].user_id : null;
}

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = ['http://localhost:5173', 'http://localhost:5176'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());

app.use("/uploads", express.static(UPLOAD_DIR));

async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const userId = await getUserIdFromToken(req);
  if (userId === null) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  (req as express.Request & { userId: number }).userId = userId;
  next();
}

const dormPhotosUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const uid = (req as express.Request & { userId?: number }).userId;
      if (uid == null) return cb(new Error("Unauthorized"), "");
      const dir = path.join(DORMS_PHOTOS_DIR, String(uid));
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const safe = (file.originalname || "photo").replace(/[^a-zA-Z0-9.-]/g, "_");
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

// Signup
app.post("/auth/signup", async (req, res) => {
  const { fullName, username, email, password, platform } = req.body;

  if (!fullName || !username || !email || !password || !platform) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (!["web", "mobile"].includes(platform)) {
    return res.status(400).json({ message: "Invalid platform" });
  }

  try {
    const check = await pool.query(
      "SELECT * FROM users WHERE username=$1 OR email=$2",
      [username, email]
    );

    if (check.rows.length > 0) {
      return res.status(400).json({ message: "Username or email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (full_name, username, email, password, platform) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, platform, full_name`,
      [fullName, username, email, hashedPassword, platform]
    );
    const user = result.rows[0];
    const token = await createSession(user.id);

    res.status(201).json({
      message: "User created successfully",
      user: { id: user.id, username: user.username, email: user.email, platform: user.platform, fullName: user.full_name },
      token,
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Database error" });
  }
});

// Login
app.post("/auth/login", async (req, res) => {
  const { identifier, password, platform } = req.body;

  if (!identifier || !password || !platform) {
    return res.status(400).json({ message: "Username/email, password, and platform are required" });
  }

  if (!["web", "mobile"].includes(platform)) {
    return res.status(400).json({ message: "Invalid platform" });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE username=$1 OR email=$1",
      [identifier]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "User not found" });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ message: "Wrong password" });
    }

    if (user.platform !== platform) {
      return res.status(403).json({ message: `This account cannot log in from ${platform}` });
    }

    const token = await createSession(user.id);

    res.json({
      message: "Login successful",
      user: { id: user.id, username: user.username, email: user.email, platform: user.platform, fullName: user.full_name },
      token,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Database error" });
  }
});

// Get current user by session token
app.get("/auth/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "No session token" });
  }

  try {
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.username, u.email, u.platform
       FROM users u
       JOIN sessions s ON s.user_id = u.id
       WHERE s.token = $1 AND s.expires_at > current_timestamp`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid or expired session" });
    }

    const user = result.rows[0];
    res.json({
      user: { id: user.id, username: user.username, email: user.email, platform: user.platform, fullName: user.full_name },
    });
  } catch (err) {
    console.error("Auth me error:", err);
    res.status(500).json({ message: "Database error" });
  }
});

// Logout
app.post("/auth/logout", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(200).json({ message: "Logged out" });
  }

  try {
    await pool.query("DELETE FROM sessions WHERE token = $1", [token]);
    res.json({ message: "Logged out" });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ message: "Database error" });
  }
});

// Get current user's dorm
app.get("/dorms/me", async (req, res) => {
  const userId = await getUserIdFromToken(req);
  if (userId === null) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const result = await pool.query(
      "SELECT id, dorm_name, email, phone, price, deposit, advance, address, room_capacity, utilities, photo_urls FROM dorms WHERE user_id = $1",
      [userId]
    );
    if (result.rows.length === 0) {
      return res.json({ dorm: null });
    }
    res.json({ dorm: result.rows[0] });
  } catch (err) {
    console.error("Get dorm error:", err);
    res.status(500).json({ message: "Database error" });
  }
});

// Create or update current user's dorm
app.post(
  "/dorms",
  requireAuth,
  dormPhotosUpload.array("photos", 10),
  async (req: express.Request, res: express.Response) => {
    const userId = (req as express.Request & { userId: number }).userId;
    const body = req.body as {
      dormName?: string;
      email?: string;
      phone?: string;
      price?: string;
      deposit?: string;
      advance?: string;
      address?: string;
      capacity?: string;
      water?: string;
      electricity?: string;
      gas?: string;
    };
    const { dormName, email, phone, price, deposit, advance, address, capacity, water, electricity, gas } = body;
    const files = (req as express.Request & { files?: Express.Multer.File[] }).files;

    if (!dormName || !email || !phone || !price || !address || capacity == null) {
      return res.status(400).json({ message: "All dorm fields are required" });
    }

    const phoneVal = String(phone).replace(/^\+63/, "").trim() || phone;

    const utilities: string[] = [];
    if (water === "true" || water === true) utilities.push("water");
    if (electricity === "true" || electricity === true) utilities.push("electricity");
    if (gas === "true" || gas === true) utilities.push("gas");

    const newPhotoUrls: string[] =
      files && files.length > 0
        ? files.map((f) => "/uploads/dorms/" + String(userId) + "/" + f.filename)
        : [];

    try {
      let photoUrlsToSave: string[] = newPhotoUrls;
      if (newPhotoUrls.length < 4) {
        const existing = await pool.query("SELECT photo_urls FROM dorms WHERE user_id = $1", [userId]);
        const existingUrls: string[] = existing.rows[0]?.photo_urls || [];
        photoUrlsToSave = existingUrls.length > 0 ? existingUrls : newPhotoUrls;
      }

      await pool.query(
        `INSERT INTO dorms (user_id, dorm_name, email, phone, price, deposit, advance, address, room_capacity, utilities, photo_urls)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (user_id) DO UPDATE SET
           dorm_name = EXCLUDED.dorm_name,
           email = EXCLUDED.email,
           phone = EXCLUDED.phone,
           price = EXCLUDED.price,
           deposit = EXCLUDED.deposit,
           advance = EXCLUDED.advance,
           address = EXCLUDED.address,
           room_capacity = EXCLUDED.room_capacity,
           utilities = EXCLUDED.utilities,
           photo_urls = CASE WHEN EXCLUDED.photo_urls IS NOT NULL AND jsonb_array_length(EXCLUDED.photo_urls) > 0 THEN EXCLUDED.photo_urls ELSE dorms.photo_urls END,
           updated_at = current_timestamp`,
        [userId, dormName, email, phoneVal, price, deposit || null, advance || null, address, Number(capacity), utilities, JSON.stringify(photoUrlsToSave)]
      );

      const out = await pool.query(
        "SELECT id, dorm_name, email, phone, price, deposit, advance, address, room_capacity, utilities, photo_urls FROM dorms WHERE user_id = $1",
        [userId]
      );
      res.json({ message: "Dorm saved", dorm: out.rows[0] });
    } catch (err) {
      console.error("Save dorm error:", err);
      res.status(500).json({ message: "Database error" });
    }
  }
);

// Get all available dorms (for mobile app) — also returns dorm_id for reservation linking
app.get("/dorms/available", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.id, d.user_id as owner_id, d.dorm_name, d.email, d.phone, d.price, d.deposit, d.advance, 
              d.address, d.room_capacity, d.utilities, d.photo_urls,
              u.full_name as owner_name
       FROM dorms d
       JOIN users u ON d.user_id = u.id
       ORDER BY d.created_at DESC`
    );

    const dorms = result.rows.map(row => ({
      id: row.id,
      owner_id: row.owner_id,
      dorm_name: row.dorm_name,
      email: row.email,
      phone: row.phone,
      price: row.price,
      deposit: row.deposit,
      advance: row.advance,
      address: row.address,
      room_capacity: row.room_capacity,
      utilities: row.utilities,
      photo_urls: row.photo_urls,
      owner_name: row.owner_name
    }));

    res.json(dorms);
  } catch (err) {
    console.error("Get available dorms error:", err);
    res.status(500).json({ message: "Database error" });
  }
});

// Get users (test)
app.get("/users", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, full_name, username, email, created_at FROM users"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ message: "Database error" });
  }
});

// ─────────────────────────────────────────────
// RESERVATIONS
// ─────────────────────────────────────────────

// POST /reservations — called from Android when tenant confirms reservation
// Looks up dorm by name to find owner, saves dorm_owner_id so only that admin sees it
app.post("/reservations", async (req, res) => {
  const {
    dorm_name,
    location,
    full_name,
    phone,
    move_in_date,
    duration_months,
    price_per_month,
    deposit,
    advance,
    total_amount,
    notes,
    payment_method,
    dorm_owner_id,
  } = req.body;

  if (!dorm_name || !full_name || !phone || !move_in_date || !duration_months) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    // Look up the dorm owner if dorm_owner_id not provided
    let ownerId = dorm_owner_id ?? null;
    if (!ownerId) {
      const dormResult = await pool.query(
        "SELECT user_id FROM dorms WHERE dorm_name = $1 LIMIT 1",
        [dorm_name]
      );
      if (dormResult.rows.length > 0) {
        ownerId = dormResult.rows[0].user_id;
      }
    }

    const result = await pool.query(
      `INSERT INTO reservations
        (dorm_name, location, full_name, phone, move_in_date, duration_months,
         price_per_month, deposit, advance, total_amount, notes, payment_method,
         dorm_owner_id, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending', NOW())
       RETURNING *`,
      [
        dorm_name,
        location,
        full_name,
        phone,
        move_in_date,
        duration_months,
        price_per_month  ?? 0,
        deposit          ?? 0,
        advance          ?? 0,
        total_amount     ?? 0,
        notes            ?? "",
        payment_method   ?? "cash_on_move_in",
        ownerId,
      ]
    );

    return res.status(201).json({
      message: "Reservation submitted successfully",
      reservation: result.rows[0],
    });
  } catch (err) {
    console.error("Reservation error:", err);
    return res.status(500).json({ message: "Database error" });
  }
});

// GET /reservations — only returns reservations for the logged-in admin's dorm
app.get("/reservations", async (req, res) => {
  const userId = await getUserIdFromToken(req);
  if (userId === null) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const result = await pool.query(
      `SELECT id, dorm_name, location, full_name, phone, move_in_date,
              duration_months, price_per_month, deposit, advance, total_amount,
              notes, payment_method, status, created_at
       FROM reservations
       WHERE dorm_owner_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error("Get reservations error:", err);
    return res.status(500).json({ message: "Database error" });
  }
});

// PATCH /reservations/:id/status — owner confirms or rejects a reservation
app.patch("/reservations/:id/status", async (req, res) => {
  const userId = await getUserIdFromToken(req);
  if (userId === null) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { status } = req.body;
  if (!["pending", "approved", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  try {
    // Only allow owner to update their own reservations
    const result = await pool.query(
      "UPDATE reservations SET status = $1 WHERE id = $2 AND dorm_owner_id = $3 RETURNING *",
      [status, req.params.id, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Reservation not found or not authorized" });
    }
    return res.json({ message: "Status updated", reservation: result.rows[0] });
  } catch (err) {
    console.error("Update status error:", err);
    return res.status(500).json({ message: "Database error" });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://192.168.68.127:${PORT}`);
});