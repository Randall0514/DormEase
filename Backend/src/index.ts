import express from "express";
import * as dotenv from "dotenv";
import bcrypt from "bcryptjs";
import cors from "cors";
import { pool } from "./db";

dotenv.config();

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

// Root
app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

// Signup
app.post("/auth/signup", async (req, res) => {
  const { fullName, username, email, password } = req.body;

  if (!fullName || !username || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    // Check if username or email already exists
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
      `INSERT INTO users (full_name, username, email, password) 
       VALUES ($1, $2, $3, $4) RETURNING id, username, email`,
      [fullName, username, email, hashedPassword]
    );

    res.status(201).json({ message: "User created successfully", user: result.rows[0] });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Database error" });
  }
});

// Login
app.post("/auth/login", async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ message: "Username/email and password are required" });
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

    res.json({ message: "Login successful", user: { id: user.id, username: user.username, email: user.email } });
  } catch (err) {
    console.error("Login error:", err);
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://192.168.1.33:${PORT}`);
});

