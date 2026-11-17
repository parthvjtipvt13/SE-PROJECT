import { Router } from "express";
import bcrypt from "bcryptjs";
import { q, logActivity } from "../db.js";
import { signToken, requireAuth } from "../middleware/auth.js";
import { HttpError, need } from "../access.js";

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/register  (students self-register; guides/coordinators are created by the coordinator)
router.post("/register", async (req, res) => {
  const name = need(req.body.name, "Name");
  const email = need(req.body.email, "Email").toLowerCase();
  const roll_no = need(req.body.roll_no, "Roll number");
  const password = need(req.body.password, "Password");
  if (!EMAIL_RE.test(email)) throw new HttpError(400, "Enter a valid email address");
  if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters");

  const dup = await q("SELECT 1 FROM users WHERE email = $1 OR roll_no = $2", [email, roll_no]);
  if (dup.rowCount) throw new HttpError(409, "Email or roll number is already registered");

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await q(
    `INSERT INTO users (name, email, password_hash, role, roll_no, department)
     VALUES ($1,$2,$3,'student',$4,'Information Technology')
     RETURNING user_id, name, email, role, roll_no`,
    [name, email, hash, roll_no]
  );
  await logActivity(rows[0].user_id, "register", `Student ${name} registered`);
  res.status(201).json({ token: signToken(rows[0]), user: rows[0] });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const email = need(req.body.email, "Email").toLowerCase();
  const password = need(req.body.password, "Password");
  const { rows } = await q("SELECT * FROM users WHERE email = $1", [email]);
  const u = rows[0];
  if (!u || u.status !== "active" || !(await bcrypt.compare(password, u.password_hash))) {
    throw new HttpError(401, "Invalid email or password");
  }
  await logActivity(u.user_id, "login", null);
  res.json({
    token: signToken(u),
    user: { user_id: u.user_id, name: u.name, email: u.email, role: u.role, roll_no: u.roll_no },
  });
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req, res) => {
  const { rows } = await q(
    "SELECT user_id, name, email, role, roll_no, department FROM users WHERE user_id = $1",
    [req.user.id]
  );
  if (!rows[0]) throw new HttpError(401, "User no longer exists");
  res.json(rows[0]);
});

export default router;
