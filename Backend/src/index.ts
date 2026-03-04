import express from "express";
import * as dotenv from "dotenv";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import cors from "cors";
import multer from "multer";
import nodemailer from "nodemailer";
import path from "path";
import fs from "fs";
import http from "http";
import { pool } from "./db";
import { initializeWebSocket, notifyUser } from "./websocket";

dotenv.config();

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const DORMS_PHOTOS_DIR = path.join(UPLOAD_DIR, "dorms");
if (!fs.existsSync(DORMS_PHOTOS_DIR)) {
  fs.mkdirSync(DORMS_PHOTOS_DIR, { recursive: true });
}

const SESSION_MINUTES = Number(process.env.SESSION_MINUTES) || 60 * 24 * 7;
const SIGNUP_OTP_TTL_MINUTES = Number(process.env.SIGNUP_OTP_TTL_MINUTES) || 10;
const SIGNUP_OTP_RESEND_SECONDS = Number(process.env.SIGNUP_OTP_RESEND_SECONDS) || 60;
const SIGNUP_OTP_MAX_ATTEMPTS = Number(process.env.SIGNUP_OTP_MAX_ATTEMPTS) || 5;
const CHANGE_OTP_TTL_MINUTES = Number(process.env.CHANGE_OTP_TTL_MINUTES) || 10;
const CHANGE_OTP_RESEND_SECONDS = Number(process.env.CHANGE_OTP_RESEND_SECONDS) || 60;
const CHANGE_OTP_MAX_ATTEMPTS = Number(process.env.CHANGE_OTP_MAX_ATTEMPTS) || 5;

type SignupOtpRecord = {
  code: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
};

type ChangeOtpRecord = {
  userId: number;
  code: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
};

const signupOtpStore = new Map<string, SignupOtpRecord>();
const changeOtpStore = new Map<number, ChangeOtpRecord>();
let smtpTransporter: nodemailer.Transporter | null | undefined;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateSignupOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getSmtpTransporter(): nodemailer.Transporter | null {
  if (smtpTransporter !== undefined) {
    return smtpTransporter;
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === "true";

  if (!host || !user || !pass) {
    smtpTransporter = null;
    return smtpTransporter;
  }

  smtpTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  return smtpTransporter;
}

function verifyAndConsumeSignupOtp(email: string, otp: string): { ok: boolean; message?: string } {
  const normalizedEmail = normalizeEmail(email);
  const record = signupOtpStore.get(normalizedEmail);

  if (!record) {
    return { ok: false, message: "OTP is missing or expired. Please request a new OTP." };
  }

  if (Date.now() > record.expiresAt) {
    signupOtpStore.delete(normalizedEmail);
    return { ok: false, message: "OTP has expired. Please request a new OTP." };
  }

  if (record.attempts >= SIGNUP_OTP_MAX_ATTEMPTS) {
    signupOtpStore.delete(normalizedEmail);
    return { ok: false, message: "Too many OTP attempts. Please request a new OTP." };
  }

  if (record.code !== String(otp || "").trim()) {
    record.attempts += 1;
    signupOtpStore.set(normalizedEmail, record);
    return { ok: false, message: "Invalid OTP code." };
  }

  signupOtpStore.delete(normalizedEmail);
  return { ok: true };
}

function verifyAndConsumeChangeOtp(userId: number, otp: string): { ok: boolean; message?: string } {
  const record = changeOtpStore.get(userId);

  if (!record) {
    return { ok: false, message: "OTP is missing or expired. Please request a new OTP." };
  }

  if (Date.now() > record.expiresAt) {
    changeOtpStore.delete(userId);
    return { ok: false, message: "OTP has expired. Please request a new OTP." };
  }

  if (record.attempts >= CHANGE_OTP_MAX_ATTEMPTS) {
    changeOtpStore.delete(userId);
    return { ok: false, message: "Too many OTP attempts. Please request a new OTP." };
  }

  if (record.code !== String(otp || "").trim()) {
    record.attempts += 1;
    changeOtpStore.set(userId, record);
    return { ok: false, message: "Invalid OTP code." };
  }

  changeOtpStore.delete(userId);
  return { ok: true };
}

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

app.get("/", (_req, res) => {
  res.send("Backend running 🚀");
});

// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────

app.post("/auth/request-signup-otp", async (req, res) => {
  const { email, username } = req.body as { email?: string; username?: string };
  if (!email || !username) {
    return res.status(400).json({ message: "Email and username are required" });
  }

  const normalizedEmail = normalizeEmail(email);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({ message: "Invalid email address" });
  }

  const existingOtp = signupOtpStore.get(normalizedEmail);
  if (existingOtp && Date.now() - existingOtp.lastSentAt < SIGNUP_OTP_RESEND_SECONDS * 1000) {
    const secondsRemaining = Math.ceil(
      (SIGNUP_OTP_RESEND_SECONDS * 1000 - (Date.now() - existingOtp.lastSentAt)) / 1000
    );
    return res.status(429).json({
      message: `Please wait ${secondsRemaining}s before requesting another OTP`,
    });
  }

  try {
    const check = await pool.query(
      "SELECT id FROM users WHERE username=$1 OR email=$2",
      [username, normalizedEmail]
    );
    if (check.rows.length > 0) {
      return res.status(400).json({ message: "Username or email already exists" });
    }

    const transporter = getSmtpTransporter();
    if (!transporter) {
      return res.status(500).json({ message: "SMTP is not configured on the server" });
    }

    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
    if (!fromAddress) {
      return res.status(500).json({ message: "SMTP sender is not configured" });
    }

    const otpCode = generateSignupOtpCode();
    signupOtpStore.set(normalizedEmail, {
      code: otpCode,
      expiresAt: Date.now() + SIGNUP_OTP_TTL_MINUTES * 60 * 1000,
      attempts: 0,
      lastSentAt: Date.now(),
    });

    await transporter.sendMail({
      from: fromAddress,
      to: normalizedEmail,
      subject: "DormEase signup verification code",
      text: `Your DormEase OTP is ${otpCode}. It expires in ${SIGNUP_OTP_TTL_MINUTES} minutes.`,
      html: `<p>Your DormEase OTP is <b>${otpCode}</b>.</p><p>It expires in ${SIGNUP_OTP_TTL_MINUTES} minutes.</p>`,
    });

    res.json({ message: "OTP sent successfully" });
  } catch (err: any) {
    console.error("Request signup OTP error:", err);
    console.error("SMTP Error details:", {
      message: err.message,
      code: err.code,
      command: err.command,
      response: err.response,
      responseCode: err.responseCode,
    });
    signupOtpStore.delete(normalizedEmail);
    const errorMsg = err.response || err.message || "Failed to send OTP";
    res.status(500).json({ message: `Failed to send OTP: ${errorMsg}` });
  }
});

app.post("/auth/signup", async (req, res) => {
  const { fullName, username, email, password, otp, platform } = req.body;
  if (!fullName || !username || !email || !password || !otp || !platform) {
    return res.status(400).json({ message: "All fields are required" });
  }
  if (!["web", "mobile"].includes(platform)) {
    return res.status(400).json({ message: "Invalid platform" });
  }
  try {
    const normalizedEmail = normalizeEmail(email);
    const check = await pool.query(
      "SELECT * FROM users WHERE username=$1 OR email=$2",
      [username, normalizedEmail]
    );
    if (check.rows.length > 0) {
      return res.status(400).json({ message: "Username or email already exists" });
    }

    const otpResult = verifyAndConsumeSignupOtp(normalizedEmail, String(otp));
    if (!otpResult.ok) {
      return res.status(400).json({ message: otpResult.message });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (full_name, username, email, password, platform)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, platform, full_name`,
      [fullName, username, normalizedEmail, hashedPassword, platform]
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

app.patch("/auth/me", requireAuth, async (req, res) => {
  const userId = (req as express.Request & { userId: number }).userId;
  const { fullName, username, email, password } = req.body as {
    fullName?: string; username?: string; email?: string; password?: string;
  };
  if (!fullName && !username && !email && !password) {
    return res.status(400).json({ message: "No fields to update" });
  }
  try {
    if (username) {
      const q = await pool.query("SELECT id FROM users WHERE username = $1 AND id != $2", [username, userId]);
      if (q.rows.length > 0) return res.status(400).json({ message: "Username already taken" });
    }
    if (email) {
      const q = await pool.query("SELECT id FROM users WHERE email = $1 AND id != $2", [email, userId]);
      if (q.rows.length > 0) return res.status(400).json({ message: "Email already taken" });
    }
    const fields: string[] = [];
    const vals: any[] = [];
    let idx = 1;
    if (fullName) { fields.push(`full_name = $${idx++}`); vals.push(fullName); }
    if (username) { fields.push(`username = $${idx++}`); vals.push(username); }
    if (email)    { fields.push(`email = $${idx++}`);    vals.push(email); }
    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      fields.push(`password = $${idx++}`);
      vals.push(hashed);
    }
    if (fields.length === 0) return res.status(400).json({ message: "Nothing to update" });
    const sql = `UPDATE users SET ${fields.join(", ")} WHERE id = $${idx} RETURNING id, full_name, username, email, platform`;
    vals.push(userId);
    const result = await pool.query(sql, vals);
    const updated = result.rows[0];
    res.json({ user: { id: updated.id, fullName: updated.full_name, username: updated.username, email: updated.email, platform: updated.platform } });
  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).json({ message: "Database error" });
  }
});

// POST /auth/request-change-otp - Request OTP for password/email changes
app.post("/auth/request-change-otp", requireAuth, async (req, res) => {
  const userId = (req as express.Request & { userId: number }).userId;
  try {
    const user = await pool.query("SELECT email FROM users WHERE id = $1", [userId]);
    if (user.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const userEmail = user.rows[0].email;
    const existing = changeOtpStore.get(userId);
    
    // Check if OTP was recently sent
    if (existing && Date.now() - existing.lastSentAt < CHANGE_OTP_RESEND_SECONDS * 1000) {
      return res.status(429).json({ message: `Please wait ${Math.ceil((CHANGE_OTP_RESEND_SECONDS * 1000 - (Date.now() - existing.lastSentAt)) / 1000)} seconds before requesting again` });
    }
    
    // Generate new OTP
    const otp = generateSignupOtpCode();
    const expiresAt = Date.now() + CHANGE_OTP_TTL_MINUTES * 60 * 1000;
    
    changeOtpStore.set(userId, {
      userId,
      code: otp,
      expiresAt,
      attempts: 0,
      lastSentAt: Date.now(),
    });
    
    // Send OTP email
    const transporter = getSmtpTransporter();
    if (transporter) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || 'noreply@dormease.com',
          to: userEmail,
          subject: 'DormEase Account Verification Code',
          html: `
            <div style="font-family: Arial, sans-serif; color: #333;">
              <h2 style="color: #4f73ff;">DormEase Account Verification</h2>
              <p>Your OTP for changing password or email is:</p>
              <h1 style="color: #4f73ff; font-size: 32px; letter-spacing: 4px;">${otp}</h1>
              <p style="color: #666;">This code expires in ${CHANGE_OTP_TTL_MINUTES} minutes.</p>
              <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error("Email send error:", emailErr);
        return res.status(500).json({ message: "Failed to send OTP email" });
      }
    }
    
    res.json({ message: "OTP sent to your email", email: userEmail });
  } catch (err) {
    console.error("Request change OTP error:", err);
    res.status(500).json({ message: "Database error" });
  }
});

// POST /auth/verify-change-otp - Verify OTP for password/email changes
app.post("/auth/verify-change-otp", requireAuth, async (req, res) => {
  const userId = (req as express.Request & { userId: number }).userId;
  const { otp } = req.body as { otp?: string };
  
  if (!otp) {
    return res.status(400).json({ message: "OTP is required" });
  }
  
  const verification = verifyAndConsumeChangeOtp(userId, otp);
  if (!verification.ok) {
    return res.status(400).json({ message: verification.message || "Invalid OTP" });
  }
  
  res.json({ message: "OTP verified successfully" });
});

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

// ─────────────────────────────────────────────
// DORMS
// ─────────────────────────────────────────────

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

app.post(
  "/dorms",
  requireAuth,
  dormPhotosUpload.array("photos", 10),
  async (req: express.Request, res: express.Response) => {
    const userId = (req as express.Request & { userId: number }).userId;
    const body = req.body as {
      dormName?: string; email?: string; phone?: string; price?: string;
      deposit?: string; advance?: string; address?: string; capacity?: string;
      utilities?: string[] | string;
    };
    const { dormName, email, phone, price, deposit, advance, address, capacity, utilities: utilitiesBody } = body;
    const files = (req as express.Request & { files?: Express.Multer.File[] }).files;

    if (!dormName || !email || !phone || !price || !address || capacity == null) {
      return res.status(400).json({ message: "All dorm fields are required" });
    }

    const phoneVal = String(phone).replace(/^\+63/, "").trim() || phone;

    let utilities: string[] = [];
    if (Array.isArray(utilitiesBody)) utilities = utilitiesBody as string[];
    else if (typeof utilitiesBody === 'string') {
      try { utilities = JSON.parse(utilitiesBody) as string[]; } catch { utilities = []; }
    }

    const newPhotoUrls: string[] =
      files && files.length > 0
        ? files.map(f => "/uploads/dorms/" + String(userId) + "/" + f.filename)
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

app.get("/dorms/available", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.id, d.user_id as owner_id, d.dorm_name, d.email, d.phone, d.price, d.deposit, d.advance,
              d.address, d.room_capacity, d.utilities, d.photo_urls,
              u.full_name as owner_name
       FROM dorms d
       JOIN users u ON d.user_id = u.id
       ORDER BY d.created_at DESC`
    );
    res.json(result.rows.map(row => ({
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
      owner_name: row.owner_name,
    })));
  } catch (err) {
    console.error("Get available dorms error:", err);
    res.status(500).json({ message: "Database error" });
  }
});

// ─────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────

app.get("/users", async (_req, res) => {
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

app.get("/messages/contacts", async (req, res) => {
  const userId = await getUserIdFromToken(req);
  if (userId === null) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const result = await pool.query(
      `WITH owner_side AS (
          SELECT DISTINCT
            u.id,
            u.full_name,
            u.username,
            u.email,
            'tenant'::text AS relation
          FROM reservations r
          JOIN users u
            ON lower(trim(coalesce(u.full_name, ''))) = lower(trim(coalesce(r.full_name, '')))
          WHERE r.dorm_owner_id = $1
            AND r.status = 'approved'
            AND r.tenant_action = 'accepted'
        ),
        tenant_side AS (
          SELECT DISTINCT
            owner.id,
            owner.full_name,
            owner.username,
            owner.email,
            'owner'::text AS relation
          FROM users me
          JOIN reservations r
            ON lower(trim(coalesce(me.full_name, ''))) = lower(trim(coalesce(r.full_name, '')))
          JOIN users owner
            ON owner.id = r.dorm_owner_id
          WHERE me.id = $1
            AND r.status = 'approved'
            AND r.tenant_action = 'accepted'
        )
        SELECT DISTINCT id, full_name, username, email, relation
        FROM (
          SELECT * FROM owner_side
          UNION ALL
          SELECT * FROM tenant_side
        ) contacts
        WHERE id <> $1
        ORDER BY full_name ASC, username ASC`,
      [userId]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("Get message contacts error:", err);
    return res.status(500).json({ message: "Database error" });
  }
});

// ─────────────────────────────────────────────
// RESERVATIONS
// ─────────────────────────────────────────────

// POST /reservations — tenant submits a reservation from Android
app.post("/reservations", async (req, res) => {
  const {
    dorm_name, location, full_name, phone, move_in_date,
    duration_months, price_per_month, deposit, advance,
    total_amount, notes, payment_method, dorm_owner_id,
  } = req.body;

  if (!dorm_name || !full_name || !phone || !move_in_date || !duration_months) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
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
        dorm_name, location, full_name, phone, move_in_date, duration_months,
        price_per_month  ?? 0,
        deposit          ?? 0,
        advance          ?? 0,
        total_amount     ?? 0,
        notes            ?? "",
        payment_method   ?? "cash_on_move_in",
        ownerId,
      ]
    );
    return res.status(201).json({ message: "Reservation submitted successfully", reservation: result.rows[0] });
  } catch (err) {
    console.error("Reservation error:", err);
    return res.status(500).json({ message: "Database error" });
  }
});

// GET /reservations — web admin sees their dorm's reservations
app.get("/reservations", async (req, res) => {
  const userId = await getUserIdFromToken(req);
  if (userId === null) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const result = await pool.query(
      `SELECT r.id, r.dorm_name, r.location, r.full_name, r.phone, r.move_in_date,
              r.duration_months, r.price_per_month, r.deposit, r.advance, r.total_amount,
              r.notes, r.payment_method, r.status, r.rejection_reason, r.termination_reason,
              r.tenant_action, r.cancel_reason, r.tenant_action_at, r.payments_paid,
              r.created_at, d.room_capacity, d.id as dorm_id
       FROM reservations r
       LEFT JOIN dorms d ON d.user_id = r.dorm_owner_id
       WHERE r.dorm_owner_id = $1
       ORDER BY r.created_at DESC`,
      [userId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error("Get reservations error:", err);
    return res.status(500).json({ message: "Database error" });
  }
});

// GET /reservations/tenant?phone=09XXXXXXXXX — Android polls for status updates
app.get("/reservations/tenant", async (req, res) => {
  const { phone } = req.query as { phone?: string };
  if (!phone) {
    return res.status(400).json({ message: "phone query param required" });
  }
  const digits = String(phone).replace(/\D/g, "");
  const last10 = digits.slice(-10);
  if (last10.length < 7) {
    return res.status(400).json({ message: "Invalid phone number" });
  }
  try {
    const result = await pool.query(
      `SELECT id, dorm_name, location, full_name, phone, move_in_date,
              duration_months, price_per_month, deposit, advance, total_amount,
              notes, payment_method, status, rejection_reason, termination_reason, created_at
       FROM reservations
       WHERE regexp_replace(phone, '[^0-9]', '', 'g') LIKE $1
       ORDER BY created_at DESC`,
      [`%${last10}`]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error("Tenant reservation poll error:", err);
    return res.status(500).json({ message: "Database error" });
  }
});

// PATCH /reservations/:id/status — owner approves or rejects
app.patch("/reservations/:id/status", async (req, res) => {
  const userId = await getUserIdFromToken(req);
  if (userId === null) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const { status, rejection_reason } = req.body;
  if (!["pending", "approved", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }
  if (status === 'rejected' && (!rejection_reason || String(rejection_reason).trim().length === 0)) {
    return res.status(400).json({ message: "Rejection reason required" });
  }
  try {
    const rid = Number(req.params.id);
    const result = await pool.query(
      `UPDATE reservations r
       SET status = $1, rejection_reason = $2
       FROM dorms d
       WHERE r.id = $3
         AND (
           r.dorm_owner_id = $4
           OR (r.dorm_owner_id IS NULL AND d.dorm_name = r.dorm_name AND d.user_id = $4)
         )
       RETURNING r.*`,
      [status, status === 'rejected' ? rejection_reason : null, rid, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Reservation not found or not authorized" });
    }
    
    // Send WebSocket notification to owner
    const io = req.app.get('io');
    if (io) {
      notifyUser(io, userId, 'reservation_updated', {
        reservationId: rid,
        status,
        message: `Reservation ${status === 'approved' ? 'approved' : 'rejected'}`,
      });
    }
    
    return res.json({ message: "Status updated", reservation: result.rows[0] });
  } catch (err) {
    console.error("Update status error:", err);
    const msg = process.env.NODE_ENV === 'production' ? 'Database error' : (err && (err as any).message) || 'Database error';
    return res.status(500).json({ message: msg });
  }
});

// ─────────────────────────────────────────────
// PATCH /reservations/:id/tenant-action
// Called by the Android app when the tenant taps Accept or Cancel.
// No auth token required — ownership verified via phone number.
// ─────────────────────────────────────────────
app.patch("/reservations/:id/tenant-action", async (req, res) => {
  const { action, phone, cancel_reason } = req.body as {
    action?: string;
    phone?: string;
    cancel_reason?: string;
  };

  if (!action || !["accepted", "cancelled"].includes(action)) {
    return res.status(400).json({ message: "action must be 'accepted' or 'cancelled'" });
  }
  if (!phone) {
    return res.status(400).json({ message: "phone is required" });
  }
  if (action === "cancelled" && (!cancel_reason || String(cancel_reason).trim().length === 0)) {
    return res.status(400).json({ message: "cancel_reason is required when cancelling" });
  }

  const rid = Number(req.params.id);
  if (isNaN(rid)) {
    return res.status(400).json({ message: "Invalid reservation id" });
  }

  const digits = String(phone).replace(/\D/g, "");
  const last10 = digits.slice(-10);

  try {
    // Verify the reservation belongs to this phone before updating
    const check = await pool.query(
      `SELECT id FROM reservations
       WHERE id = $1
         AND regexp_replace(phone, '[^0-9]', '', 'g') LIKE $2`,
      [rid, `%${last10}`]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ message: "Reservation not found or phone mismatch" });
    }

    const result = await pool.query(
      `UPDATE reservations
       SET tenant_action    = $1,
           cancel_reason    = $2,
           tenant_action_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [
        action,
        action === "cancelled" ? String(cancel_reason).trim() : null,
        rid,
      ]
    );
    
    // Send WebSocket notification to dorm owner
    const io = req.app.get('io');
    if (io && result.rows[0]?.dorm_owner_id) {
      notifyUser(io, result.rows[0].dorm_owner_id, 'reservation_updated', {
        reservationId: rid,
        tenantAction: action,
        message: `Tenant has ${action} the reservation`,
      });
    }
    
    return res.json({ message: "Tenant action recorded", reservation: result.rows[0] });
  } catch (err) {
    console.error("Tenant action error:", err);
    return res.status(500).json({ message: "Database error" });
  }
});

// PATCH /reservations/:id/mark-payment-paid
app.patch("/reservations/:id/mark-payment-paid", async (req, res) => {
  const userId = await getUserIdFromToken(req);
  if (userId === null) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const rid = Number(req.params.id);
    const { paymentNumber } = req.body;
    
    if (!paymentNumber || paymentNumber < 1) {
      return res.status(400).json({ message: "Invalid payment number" });
    }
    
    // Get current payments_paid count
    const current = await pool.query(
      "SELECT payments_paid, duration_months FROM reservations WHERE id = $1 AND dorm_owner_id = $2",
      [rid, userId]
    );
    
    if (current.rows.length === 0) {
      return res.status(404).json({ message: "Reservation not found or not authorized" });
    }
    
    const currentPaid = current.rows[0].payments_paid || 0;
    const totalPayments = current.rows[0].duration_months;
    
    // Only allow marking the next unpaid payment
    if (paymentNumber !== currentPaid + 1) {
      return res.status(400).json({ 
        message: `Can only mark payment #${currentPaid + 1} as paid. Please pay in order.` 
      });
    }
    
    if (paymentNumber > totalPayments) {
      return res.status(400).json({ message: "Payment number exceeds contract duration" });
    }
    
    // Update payments_paid
    const result = await pool.query(
      "UPDATE reservations SET payments_paid = $1 WHERE id = $2 AND dorm_owner_id = $3 RETURNING *",
      [paymentNumber, rid, userId]
    );
    
    return res.json({ message: "Payment marked as paid", reservation: result.rows[0] });
  } catch (err) {
    console.error("Mark payment paid error:", err);
    return res.status(500).json({ message: "Database error" });
  }
});

// PATCH /reservations/:id/archive
app.patch("/reservations/:id/archive", async (req, res) => {
  const userId = await getUserIdFromToken(req);
  if (userId === null) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const { termination_reason } = req.body as { termination_reason?: string };
  
  try {
    const rid = Number(req.params.id);
    const result = await pool.query(
      "UPDATE reservations SET status = $1, termination_reason = $2 WHERE id = $3 AND dorm_owner_id = $4 RETURNING *",
      ["archived", termination_reason || null, rid, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Reservation not found or not authorized" });
    }
    return res.json({ message: "Archived", reservation: result.rows[0] });
  } catch (err) {
    console.error("Archive reservation error:", err);
    const msg = process.env.NODE_ENV === 'production' ? 'Database error' : (err && (err as any).message) || 'Database error';
    return res.status(500).json({ message: msg });
  }
});

// PATCH /reservations/:id/unarchive
app.patch("/reservations/:id/unarchive", async (req, res) => {
  const userId = await getUserIdFromToken(req);
  if (userId === null) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const rid = Number(req.params.id);
    const result = await pool.query(
      "UPDATE reservations SET status = $1 WHERE id = $2 AND dorm_owner_id = $3 RETURNING *",
      ["pending", rid, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Reservation not found or not authorized" });
    }
    return res.json({ message: "Unarchived", reservation: result.rows[0] });
  } catch (err) {
    console.error("Unarchive reservation error:", err);
    const msg = process.env.NODE_ENV === 'production' ? 'Database error' : (err && (err as any).message) || 'Database error';
    return res.status(500).json({ message: msg });
  }
});

// DELETE /reservations/:id
app.delete("/reservations/:id", async (req, res) => {
  const userId = await getUserIdFromToken(req);
  if (userId === null) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const rid = Number(req.params.id);
    const result = await pool.query(
      "DELETE FROM reservations WHERE id = $1 AND dorm_owner_id = $2 RETURNING id",
      [rid, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Reservation not found or not authorized" });
    }
    return res.json({ message: "Deleted" });
  } catch (err) {
    console.error("Delete reservation error:", err);
    const msg = process.env.NODE_ENV === 'production' ? 'Database error' : (err && (err as any).message) || 'Database error';
    return res.status(500).json({ message: msg });
  }
});

// ─────────────────────────────────────────────
// SCHEMA MIGRATION
// ─────────────────────────────────────────────

async function ensureSchema(): Promise<void> {
  try {
    await pool.query("ALTER TABLE reservations ADD COLUMN IF NOT EXISTS rejection_reason text;");
    // New columns for tenant response feature
    await pool.query("ALTER TABLE reservations ADD COLUMN IF NOT EXISTS tenant_action text;");
    await pool.query("ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancel_reason text;");
    await pool.query("ALTER TABLE reservations ADD COLUMN IF NOT EXISTS tenant_action_at timestamptz;");
    // Termination reason column
    await pool.query("ALTER TABLE reservations ADD COLUMN IF NOT EXISTS termination_reason text;");
    console.log('✅ Schema up to date');
  } catch (err) {
    console.error('Error ensuring schema:', err);
  }
}

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────

async function startServer() {
  await ensureSchema();
  
  // Create HTTP server
  const httpServer = http.createServer(app);
  
  // Initialize WebSocket
  const io = initializeWebSocket(httpServer);
  
  // Store io instance on the server for easy access in routes
  // @ts-ignore
  httpServer._socketio = io;
  
  // Store io globally for use in route handlers
  app.set('io', io);
  
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running at http://192.168.68.124:${PORT}`);
    console.log(`🔌 WebSocket server is ready`);
  });
}

startServer(); 