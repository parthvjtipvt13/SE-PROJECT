import { Router } from "express";
import { q, tx, notify, logActivity } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError, getAccessibleGroup, getStudentGroup, groupStudentIds, need } from "../access.js";

const router = Router();
router.use(requireAuth);

const MS_SELECT = `
  SELECT m.milestone_id, m.group_id, g.group_no, m.title, m.due_date, m.max_marks, m.status, m.draft_notes,
         (m.due_date < CURRENT_DATE AND m.status = 'pending') AS overdue,
         (SELECT COUNT(*)::int FROM documents d WHERE d.milestone_id = m.milestone_id) AS doc_count,
         r.marks, r.feedback
    FROM milestones m
    JOIN groups g ON g.group_id = m.group_id
    LEFT JOIN reviews r ON r.milestone_id = m.milestone_id`;

// GET /api/milestones?group_id=  (scoped; student defaults to own group)
router.get("/", async (req, res) => {
  let groupId = req.query.group_id;
  if (req.user.role === "student") {
    const g = await getStudentGroup(req.user.id);
    if (!g) return res.json([]);
    groupId = g.group_id;
  }
  if (groupId) await getAccessibleGroup(req.user, groupId);

  let where = "WHERE ($1::int IS NULL OR m.group_id = $1)";
  const params = [groupId || null];
  if (!groupId && req.user.role === "guide") {
    where += " AND g.guide_id = $2";
    params.push(req.user.id);
  }
  const { rows } = await q(MS_SELECT + " " + where + " ORDER BY m.group_id, m.due_date, m.milestone_id", params);
  res.json(rows);
});

// POST /api/milestones  {title, due_date, max_marks, group_id | all_groups:true}  (coordinator)
router.post("/", requireRole("coordinator"), async (req, res) => {
  const title = need(req.body.title, "Title");
  const due = need(req.body.due_date, "Due date");
  const max = Number(req.body.max_marks ?? 25);
  if (Number.isNaN(Date.parse(due))) throw new HttpError(400, "Invalid due date");
  if (!(max > 0 && max <= 100)) throw new HttpError(400, "Max marks must be between 1 and 100");

  let groupIds;
  if (req.body.all_groups) {
    groupIds = (await q("SELECT group_id FROM groups WHERE status IN ('guide_allocated','topic_approved')")).rows.map((r) => r.group_id);
    if (!groupIds.length) throw new HttpError(409, "No eligible groups (topic approved) to assign this task to");
  } else {
    const gid = Number(need(req.body.group_id, "Group"));
    if (!(await q("SELECT 1 FROM groups WHERE group_id = $1", [gid])).rowCount) throw new HttpError(404, "Group not found");
    groupIds = [gid];
  }

  const created = await tx(async (c) => {
    const out = [];
    for (const gid of groupIds) {
      const m = (await c.query(
        "INSERT INTO milestones (group_id, title, due_date, max_marks) VALUES ($1,$2,$3,$4) RETURNING *",
        [gid, title, due, max]
      )).rows[0];
      out.push(m);
      await notify(await groupStudentIds(gid), `New task "${title}" is due on ${due}.`, "/milestones", c);
    }
    await logActivity(req.user.id, "create_milestone", `${title} for ${groupIds.length} group(s)`, c);
    return out;
  });
  res.status(201).json(created);
});

// PUT /api/milestones/:id/draft  {draft_notes}  (student auto-save)
router.put("/:id/draft", requireRole("student"), async (req, res) => {
  const m = (await q("SELECT * FROM milestones WHERE milestone_id = $1", [req.params.id])).rows[0];
  if (!m) throw new HttpError(404, "Milestone not found");
  await getAccessibleGroup(req.user, m.group_id);
  if (m.status === "reviewed") throw new HttpError(409, "This task has already been reviewed");
  const { rows } = await q(
    "UPDATE milestones SET draft_notes = $1 WHERE milestone_id = $2 RETURNING milestone_id, draft_notes",
    [String(req.body.draft_notes ?? ""), m.milestone_id]
  );
  res.json({ ...rows[0], saved_at: new Date().toISOString() });
});

// ---- schedules (review / presentation slots) ----
// GET /api/milestones/schedules/list
router.get("/schedules/list", async (req, res) => {
  let where = "";
  const params = [];
  if (req.user.role === "student") {
    where = "WHERE s.group_id = (SELECT group_id FROM group_members WHERE student_id = $1)";
    params.push(req.user.id);
  } else if (req.user.role === "guide") {
    where = "WHERE g.guide_id = $1";
    params.push(req.user.id);
  }
  const { rows } = await q(
    `SELECT s.schedule_id, s.group_id, g.group_no, s.title, s.start_time, s.end_time, s.status
       FROM schedules s JOIN groups g ON g.group_id = s.group_id ${where} ORDER BY s.start_time`,
    params
  );
  res.json(rows);
});

// POST /api/milestones/schedules  {group_id,title,start_time,end_time}
router.post("/schedules", requireRole("coordinator", "guide"), async (req, res) => {
  const gid = Number(need(req.body.group_id, "Group"));
  const title = need(req.body.title, "Title");
  const start = need(req.body.start_time, "Start time");
  const end = need(req.body.end_time, "End time");
  if (new Date(end) <= new Date(start)) throw new HttpError(400, "End time must be after start time");
  await getAccessibleGroup(req.user, gid);

  // conflict check: same guide / same group cannot have overlapping slots
  const clash = await q(
    `SELECT 1 FROM schedules s JOIN groups g ON g.group_id = s.group_id
      WHERE s.status = 'scheduled' AND tstzrange(s.start_time::timestamptz, s.end_time::timestamptz) && tstzrange($2::timestamptz, $3::timestamptz)
        AND (s.group_id = $1 OR g.guide_id = (SELECT guide_id FROM groups WHERE group_id = $1) AND g.guide_id IS NOT NULL)`,
    [gid, start, end]
  );
  if (clash.rowCount) throw new HttpError(409, "This slot overlaps with an existing schedule for the group or its guide");

  const { rows } = await q(
    "INSERT INTO schedules (group_id, title, start_time, end_time) VALUES ($1,$2,$3,$4) RETURNING *",
    [gid, title, start, end]
  );
  await notify(await groupStudentIds(gid), `Scheduled: ${title} on ${new Date(start).toLocaleString()}.`, "/milestones");
  await logActivity(req.user.id, "create_schedule", `${title} (group ${gid})`);
  res.status(201).json(rows[0]);
});

export default router;
