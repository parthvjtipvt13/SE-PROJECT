import { Router } from "express";
import { q, tx, notify, logActivity } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError, getStudentGroup, groupStudentIds, coordinatorIds, need } from "../access.js";

const router = Router();
router.use(requireAuth);

const TOPIC_SELECT = `
  SELECT t.topic_id, t.group_id, g.group_no, t.title, t.abstract, t.status, t.remark, t.submitted_at, t.reviewed_at
    FROM topics t JOIN groups g ON g.group_id = t.group_id`;

// POST /api/topics  {title, abstract}  (student, for their own group)
router.post("/", requireRole("student"), async (req, res) => {
  const title = need(req.body.title, "Title");
  const abstract = need(req.body.abstract, "Abstract");
  if (title.length > 200) throw new HttpError(400, "Title is too long (max 200 characters)");
  if (abstract.length < 30) throw new HttpError(400, "Please write a more descriptive abstract (at least 30 characters)");

  const group = await getStudentGroup(req.user.id);
  if (!group) throw new HttpError(409, "Create or join a group before submitting a topic");
  if (["topic_approved", "guide_allocated", "completed"].includes(group.status)) {
    throw new HttpError(409, "Your topic has already been approved");
  }

  // duplicate detection across other groups
  const dup = await q(
    "SELECT g.group_no FROM topics t JOIN groups g ON g.group_id = t.group_id WHERE lower(trim(t.title)) = lower($1) AND t.group_id <> $2 AND t.status IN ('pending','approved')",
    [title, group.group_id]
  );
  if (dup.rowCount) throw new HttpError(409, `A topic with this title already exists (${dup.rows[0].group_no}). Choose a different topic.`);

  const topic = await tx(async (c) => {
    await c.query("UPDATE topics SET status = 'superseded' WHERE group_id = $1 AND status IN ('pending','changes_requested','rejected')", [group.group_id]);
    const t = (await c.query("INSERT INTO topics (group_id, title, abstract) VALUES ($1,$2,$3) RETURNING *", [group.group_id, title, abstract])).rows[0];
    await c.query("UPDATE groups SET status = 'topic_submitted' WHERE group_id = $1", [group.group_id]);
    await notify(await coordinatorIds(), `${group.group_no} submitted a project topic for approval.`, "/topics", c);
    await logActivity(req.user.id, "submit_topic", `${group.group_no}: ${title}`, c);
    return t;
  });
  res.status(201).json(topic);
});

// GET /api/topics?status=pending  (scoped)
router.get("/", async (req, res) => {
  const status = req.query.status || null;
  let where = "WHERE t.status <> 'superseded' AND ($1::text IS NULL OR t.status = $1)";
  const params = [status];
  if (req.user.role === "student") {
    where = "WHERE ($1::text IS NULL OR t.status = $1) AND t.group_id = (SELECT group_id FROM group_members WHERE student_id = $2)";
    params.push(req.user.id);
  } else if (req.user.role === "guide") {
    where += " AND g.guide_id = $2";
    params.push(req.user.id);
  }
  const { rows } = await q(TOPIC_SELECT + " " + where + " ORDER BY t.submitted_at DESC, t.topic_id DESC", params);
  res.json(rows);
});

// PUT /api/topics/:id/review  {status: approved|rejected|changes_requested, remark}
router.put("/:id/review", requireRole("coordinator"), async (req, res) => {
  const status = need(req.body.status, "Decision");
  if (!["approved", "rejected", "changes_requested"].includes(status)) throw new HttpError(400, "Invalid decision");
  const remark = (req.body.remark || "").trim();
  if (status !== "approved" && !remark) throw new HttpError(400, "A remark is required when rejecting or requesting changes");

  const topic = (await q("SELECT * FROM topics WHERE topic_id = $1", [req.params.id])).rows[0];
  if (!topic) throw new HttpError(404, "Topic not found");
  if (topic.status !== "pending") throw new HttpError(409, "This topic has already been reviewed");

  const updated = await tx(async (c) => {
    const t = (await c.query(
      "UPDATE topics SET status = $1, remark = $2, reviewed_at = NOW(), reviewed_by = $3 WHERE topic_id = $4 RETURNING *",
      [status, remark || null, req.user.id, topic.topic_id]
    )).rows[0];
    if (status === "approved") await c.query("UPDATE groups SET status = 'topic_approved' WHERE group_id = $1", [topic.group_id]);
    else await c.query("UPDATE groups SET status = 'formed' WHERE group_id = $1", [topic.group_id]);
    const label = { approved: "approved", rejected: "rejected", changes_requested: "returned for changes" }[status];
    await notify(await groupStudentIds(topic.group_id), `Your topic "${topic.title}" was ${label}.`, "/topic", c);
    await logActivity(req.user.id, "review_topic", `${topic.title} -> ${status}`, c);
    return t;
  });
  res.json(updated);
});

export default router;
