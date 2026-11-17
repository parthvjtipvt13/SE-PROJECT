import { Router } from "express";
import { q, tx, notify, logActivity } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError, groupStudentIds, need } from "../access.js";

const router = Router();
router.use(requireAuth);

// POST /api/reviews  {milestone_id, marks, feedback}  (allocated guide only)
router.post("/", requireRole("guide"), async (req, res) => {
  const mid = Number(need(req.body.milestone_id, "milestone_id"));
  const marks = Number(need(req.body.marks, "Marks"));
  const feedback = (req.body.feedback || "").trim();

  const m = (await q(
    "SELECT m.*, g.guide_id, g.group_no FROM milestones m JOIN groups g ON g.group_id = m.group_id WHERE m.milestone_id = $1", [mid]
  )).rows[0];
  if (!m) throw new HttpError(404, "Milestone not found");
  if (m.guide_id !== req.user.id) throw new HttpError(403, "Only the allocated guide can review this milestone");
  if (Number.isNaN(marks) || marks < 0 || marks > Number(m.max_marks)) {
    throw new HttpError(400, `Marks must be between 0 and ${m.max_marks}`);
  }
  if (m.status === "reviewed") throw new HttpError(409, "This milestone has already been reviewed");
  if (m.status !== "submitted") throw new HttpError(409, "The group has not submitted a document for this milestone yet");
  if (!feedback) throw new HttpError(400, "Feedback is required");

  const review = await tx(async (c) => {
    const r = (await c.query(
      "INSERT INTO reviews (milestone_id, guide_id, marks, feedback) VALUES ($1,$2,$3,$4) RETURNING *",
      [mid, req.user.id, marks, feedback]
    )).rows[0];
    await c.query("UPDATE milestones SET status = 'reviewed' WHERE milestone_id = $1", [mid]);
    await notify(await groupStudentIds(m.group_id), `"${m.title}" was reviewed: ${marks}/${m.max_marks}.`, "/milestones", c);
    await logActivity(req.user.id, "review_milestone", `${m.group_no} / ${m.title}: ${marks}/${m.max_marks}`, c);
    return r;
  });
  res.status(201).json(review);
});

// GET /api/reviews/queue  (guide: submitted milestones waiting for review)
router.get("/queue", requireRole("guide"), async (req, res) => {
  const { rows } = await q(
    `SELECT m.milestone_id, m.title, m.due_date, m.max_marks, g.group_id, g.group_no,
            (SELECT MAX(version) FROM documents d WHERE d.milestone_id = m.milestone_id) AS latest_version,
            (SELECT bool_or(is_late) FROM documents d WHERE d.milestone_id = m.milestone_id) AS is_late
       FROM milestones m JOIN groups g ON g.group_id = m.group_id
      WHERE g.guide_id = $1 AND m.status = 'submitted'
      ORDER BY m.due_date`,
    [req.user.id]
  );
  res.json(rows);
});

export default router;
