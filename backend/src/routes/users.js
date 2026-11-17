import { Router } from "express";
import bcrypt from "bcryptjs";
import { q, logActivity } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError, need } from "../access.js";

const router = Router();
router.use(requireAuth, requireRole("coordinator"));

// GET /api/users?role=guide
router.get("/", async (req, res) => {
  const { role } = req.query;
  const { rows } = await q(
    `SELECT u.user_id, u.name, u.email, u.role, u.roll_no, u.department, u.max_groups, u.status, u.created_at,
            (SELECT COUNT(*)::int FROM groups g WHERE g.guide_id = u.user_id) AS allocated_groups
       FROM users u
      WHERE ($1::text IS NULL OR u.role = $1)
      ORDER BY u.role, u.name`,
    [role || null]
  );
  res.json(rows);
});

// POST /api/users  (create a guide, student or coordinator)
router.post("/", async (req, res) => {
  const name = need(req.body.name, "Name");
  const email = need(req.body.email, "Email").toLowerCase();
  const password = need(req.body.password, "Password");
  const role = need(req.body.role, "Role");
  if (!["student", "guide", "coordinator"].includes(role)) throw new HttpError(400, "Invalid role");
  if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
  if (role === "student") need(req.body.roll_no, "Roll number");

  const dup = await q("SELECT 1 FROM users WHERE email = $1 OR ($2::text IS NOT NULL AND roll_no = $2)", [email, req.body.roll_no || null]);
  if (dup.rowCount) throw new HttpError(409, "Email or roll number already exists");

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await q(
    `INSERT INTO users (name, email, password_hash, role, roll_no, department, max_groups)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING user_id, name, email, role, roll_no, department, max_groups, status`,
    [name, email, hash, role, req.body.roll_no || null, req.body.department || null, Number(req.body.max_groups) || 4]
  );
  await logActivity(req.user.id, "create_user", `${role}: ${name}`);
  res.status(201).json(rows[0]);
});

// PUT /api/users/:id/status  {status: 'active' | 'inactive'}
router.put("/:id/status", async (req, res) => {
  const status = need(req.body.status, "Status");
  if (!["active", "inactive"].includes(status)) throw new HttpError(400, "Invalid status");
  if (Number(req.params.id) === req.user.id) throw new HttpError(400, "You cannot change your own status");
  const { rows } = await q("UPDATE users SET status = $1 WHERE user_id = $2 RETURNING user_id, name, status", [status, req.params.id]);
  if (!rows[0]) throw new HttpError(404, "User not found");
  await logActivity(req.user.id, "user_status", `${rows[0].name} -> ${status}`);
  res.json(rows[0]);
});

// GET /api/users/activity  recent activity log
router.get("/activity/log", async (_req, res) => {
  const { rows } = await q(
    `SELECT a.log_id, a.action, a.detail, a.created_at, u.name AS user_name
       FROM activity_log a LEFT JOIN users u ON u.user_id = a.user_id
      ORDER BY a.created_at DESC, a.log_id DESC LIMIT 100`
  );
  res.json(rows);
});

export default router;
