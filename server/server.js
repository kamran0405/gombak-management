// ===============================
// Dependencies
// ===============================
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import mysql from "mysql2/promise";
import session from "express-session";

const app = express();
const PORT = 5000;

// ===============================
// Middleware
// ===============================
app.use(cors({
  origin: ["http://127.0.0.1:3000", "http://localhost:3000"], // frontend allowed
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  secret: "tajneed_secret_key",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // true if HTTPS
}));

// ===============================
// MySQL Connection Pool
// ===============================
const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "kamran-2008",
  database: "gombak_tajneed"
});

// ===============================
// Middleware to Protect Routes
// ===============================
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

// ===============================
// Authentication
// ===============================
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      "SELECT * FROM users WHERE email = ? AND password = ?",
      [email, password]
    );
    conn.release();

    if (rows.length > 0) {
      req.session.user = { id: rows[0].id, email: rows[0].email };
      return res.json({ success: true, message: "✅ Login successful" });
    } else {
      return res.status(401).json({ success: false, message: "❌ Invalid credentials" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "❌ Server error" });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true, message: "✅ Logged out" });
  });
});

app.get("/api/protected", requireLogin, (req, res) => {
  res.json({ success: true, user: req.session.user });
});

// ===============================
// Register Member (Protected)
// ===============================
app.post("/register", requireLogin, async (req, res) => {
  try {
    const { name, tajneed, gender, group, region, halqa, address, phone, chanda } = req.body;
    const conn = await pool.getConnection();

    const [groupRow] = await conn.query("SELECT group_id FROM tajneed_groups WHERE group_name = ?", [group]);
    const [regionRow] = await conn.query("SELECT region_id FROM regions WHERE region_name = ?", [region]);
    const [halqaRow] = await conn.query("SELECT halqa_id FROM halqas WHERE halqa_name = ?", [halqa]);

    const group_id = groupRow.length ? groupRow[0].group_id : null;
    const region_id = regionRow.length ? regionRow[0].region_id : null;
    const halqa_id = halqaRow.length ? halqaRow[0].halqa_id : null;

    if (!group_id || !region_id || !halqa_id) {
      conn.release();
      return res.status(400).json({ message: "❌ Invalid group/region/halqa" });
    }

    await conn.query(
      `INSERT INTO members
       (name, tajneed_number, gender, group_id, region_id, halqa_id, address, phone_number, chanda_paid)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, tajneed, gender, group_id, region_id, halqa_id, address, phone, chanda]
    );

    conn.release();
    res.status(201).json({ message: "✅ Registration Successful!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Server Error", error: err.message });
  }
});

// ===============================
// Public Members List
// ===============================
app.get("/members", async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [results] = await conn.query(`
      SELECT m.member_id, m.name, m.tajneed_number, m.gender,
             g.group_name, r.region_name, h.halqa_name,
             m.address, m.phone_number, m.chanda_paid
      FROM members m
      JOIN tajneed_groups g ON m.group_id = g.group_id
      JOIN regions r ON m.region_id = r.region_id
      JOIN halqas h ON m.halqa_id = h.halqa_id
    `);
    conn.release();
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// ===============================
// Start Server
// ===============================
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
