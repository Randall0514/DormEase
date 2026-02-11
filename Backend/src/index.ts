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

const SESSION_DAYS = 7;

function createSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

async function createSession(userId: number): Promise<string> {
  const token = createSessionToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);
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

// Middleware
const allowedOrigins = ['http://localhost:5173', 'http://localhost:5176'];
app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (e.g., curl, Postman)
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

// Serve uploaded files (e.g. dorm photos)
app.use("/uploads", express.static(UPLOAD_DIR));

// Middleware: require auth and set req.userId for multipart routes
async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const userId = await getUserIdFromToken(req);
  if (userId === null) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  (req as express.Request & { userId: number }).userId = userId;
  next();
}

// Multer: store dorm photos in uploads/dorms/{userId}/
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
});

// Root
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
    // Check if username or email exists
    const check = await pool.query(
      "SELECT * FROM users WHERE username=$1 OR email=$2",
      [username, email]
    );

    if (check.rows.length > 0) {
      return res.status(400).json({ message: "Username or email already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
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

    // PLATFORM CHECK
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

// Logout: invalidate session
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

// Get current user's dorm (setup form data)
app.get("/dorms/me", async (req, res) => {
  const userId = await getUserIdFromToken(req);
  if (userId === null) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const result = await pool.query(
      "SELECT id, dorm_name, email, phone, price, address, room_capacity, photo_urls FROM dorms WHERE user_id = $1",
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

// Create or update current user's dorm (from Setup Your Dorm form) + photo uploads
app.post(
  "/dorms",
  requireAuth,
  dormPhotosUpload.array("photos", 10),
  async (req: express.Request, res: express.Response) => {
    const userId = (req as express.Request & { userId: number }).userId;
    const body = req.body as { dormName?: string; email?: string; phone?: string; price?: string; address?: string; capacity?: string };
    const { dormName, email, phone, price, address, capacity } = body;
    const files = (req as express.Request & { files?: Express.Multer.File[] }).files;

    if (!dormName || !email || !phone || !price || !address || capacity == null) {
      return res.status(400).json({ message: "All dorm fields are required" });
    }

    const phoneVal = String(phone).replace(/^\+63/, "").trim() || phone;

    // Build photo URLs: relative paths like /uploads/dorms/1/123-photo.jpg
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
        `INSERT INTO dorms (user_id, dorm_name, email, phone, price, address, room_capacity, photo_urls)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id) DO UPDATE SET
           dorm_name = EXCLUDED.dorm_name,
           email = EXCLUDED.email,
           phone = EXCLUDED.phone,
           price = EXCLUDED.price,
           address = EXCLUDED.address,
           room_capacity = EXCLUDED.room_capacity,
           photo_urls = CASE WHEN EXCLUDED.photo_urls IS NOT NULL AND jsonb_array_length(EXCLUDED.photo_urls) > 0 THEN EXCLUDED.photo_urls ELSE dorms.photo_urls END,
           updated_at = current_timestamp`,
        [userId, dormName, email, phoneVal, price, address, Number(capacity), JSON.stringify(photoUrlsToSave)]
      );

      const out = await pool.query(
        "SELECT id, dorm_name, email, phone, price, address, room_capacity, photo_urls FROM dorms WHERE user_id = $1",
        [userId]
      );
      res.json({ message: "Dorm saved", dorm: out.rows[0] });
    } catch (err) {
      console.error("Save dorm error:", err);
      res.status(500).json({ message: "Database error" });
    }
  }
);

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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://192.168.1.33:${PORT}`);
});

