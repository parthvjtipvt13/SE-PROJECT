import { Router } from "express";
import { q, tx, notify, logActivity } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError, getAccessibleGroup, getStudentGroup, groupStudentIds, need } from "../access.js";

const router = Router();
router.use(requireAuth);

const MAX_MEMBERS = 5;

const GROUP_SELECT = `
  SELECT g.group_id, g.group_no, g.status, g.guide_id, g.result_published, g.created_at,
         gu.name AS guide_name,
         COALESCE((SELECT json_agg(json_build_object('user_id', u.user_id, 'name', u.name, 'roll_no', u.roll_no) ORDER BY u.name)
                     FROM group_members m JOIN users u ON u.user_id = m.student_id
                    WHERE m.group_id = g.group_id), '[]') AS members,
         (SELECT t.title FROM topics t WHERE t.group_id = g.group_id AND t.status <> 'superseded'
           ORDER BY t.submitted_at DESC, t.topic_id DESC LIMIT 1) AS topic_title,
         (SELECT t.status FROM topics t WHERE t.group_id = g.group_id AND t.status <> 'superseded'
           ORDER BY t.submitted_at DESC, t.topic_id DESC LIMIT 1) AS topic_status,
         (SELECT COUNT(*)::int FROM milestones ms WHERE ms.group_id = g.group_id) AS milestones_total,
         (SELECT COUNT(*)::int FROM milestones ms WHERE ms.group_id = g.group_id AND ms.status = 'reviewed') AS milestones_done
    FROM groups g LEFT JOIN users gu ON gu.user_id = g.guide_id`;

// POST /api/groups  (student creates the group, adding teammates by roll number)
router.post("/", requireRole("student"), async (req, res) => {
  if (await getStudentGroup(req.user.id)) throw new HttpError(409, "You are already in a group");
  const rolls = [...new Set((req.body.member_roll_nos || []).map((r) => String(r).trim()).filter(Boolean))];

  const group = await tx(async (c) => {
    const me = (await c.query("SELECT roll_no FROM users WHERE user_id = $1", [req.user.id])).rows[0];
    const others = rolls.filter((r) => r !== me.roll_no);
    if (others.length + 1 > MAX_MEMBERS) throw new HttpError(400, `A group can have at most ${MAX_MEMBERS} members`);

    let memberIds = [];
    if (others.length) {
      const found = await c.query(
        `SELECT u.user_id, u.roll_no, (m.group_id IS NOT NULL) AS taken
           FROM users u LEFT JOIN group_members m ON m.student_id = u.user_id
          WHERE u.role = 'student' AND u.status = 'active' AND u.roll_no = ANY($1)`,
        [others]
      );
      const missing = others.filter((r) => !found.rows.some((f) => f.roll_no === r));
      if (missing.length) throw new HttpError(400, `No registered student with roll number: ${missing.join(", ")}`);
      const taken = found.rows.filter((f) => f.taken).map((f) => f.roll_no);
      if (taken.length) throw new HttpError(409, `Already in another group: ${taken.join(", ")}`);
      memberIds = found.rows.map((f) => f.user_id);
    }

    const g = (await c.query("INSERT INTO groups DEFAULT VALUES RETURNING group_id")).rows[0];
    await c.query("UPDATE groups SET group_no = 'Group ' || group_id WHERE group_id = $1", [g.group_id]);
    for (const sid of [req.user.id, ...memberIds]) {
      await c.query("INSERT INTO group_members (student_id, group_id) VALUES ($1,$2)", [sid, g.group_id]);
    }
    await notify(memberIds, "You were added to a new project group.", "/group", c);
    await logActivity(req.user.id, "create_group", `Group ${g.group_id} with ${memberIds.length + 1} members`, c);
    return g;
  });

  const { rows } = await q(GROUP_SELECT + " WHERE g.group_id = $1", [group.group_id]);
  res.status(201).json(rows[0]);
});

// GET /api/groups  (scoped by role)
router.get("/", async (req, res) => {
  let where = "";
  let params = [];
  if (req.user.role === "guide") {
    where = "WHERE g.guide_id = $1";
    params = [req.user.id];
  } else if (req.user.role === "student") {
    where = "WHERE g.group_id = (SELECT group_id FROM group_members WHERE student_id = $1)";
    params = [req.user.id];
  }
  const { rows } = await q(GROUP_SELECT + " " + where + " ORDER BY g.group_id", params);
  res.json(rows);
});

// GET /api/groups/mine  (student's own group or null)
router.get("/mine", requireRole("student"), async (req, res) => {
  const g = await getStudentGroup(req.user.id);
  if (!g) return res.json(null);
  const { rows } = await q(GROUP_SELECT + " WHERE g.group_id = $1", [g.group_id]);
  res.json(rows[0]);
});

// GET /api/groups/:id
router.get("/:id", async (req, res) => {
  await getAccessibleGroup(req.user, req.params.id);
  const { rows } = await q(GROUP_SELECT + " WHERE g.group_id = $1", [req.params.id]);
  res.json(rows[0]);
});

// PUT /api/groups/:id/allocate-guide  {guide_id}
router.put("/:id/allocate-guide", requireRole("coordinator"), async (req, res) => {
  const guideId = Number(need(req.body.guide_id, "Guide"));
  const group = (await q("SELECT * FROM groups WHERE group_id = $1", [req.params.id])).rows[0];
  if (!group) throw new HttpError(404, "Group not found");
  if (!["topic_approved", "guide_allocated"].includes(group.status)) {
    throw new HttpError(409, "A guide can be allocated only after the group's topic is approved");
  }
  const guide = (await q("SELECT * FROM users WHERE user_id = $1 AND role = 'guide' AND status = 'active'", [guideId])).rows[0];
  if (!guide) throw new HttpError(404, "Guide not found");

  if (group.guide_id !== guideId) {
    const load = (await q("SELECT COUNT(*)::int AS n FROM groups WHERE guide_id = $1", [guideId])).rows[0].n;
    if (load >= guide.max_groups) throw new HttpError(409, `${guide.name} already has the maximum of ${guide.max_groups} groups`);
  }

  await q("UPDATE groups SET guide_id = $1, status = 'guide_allocated' WHERE group_id = $2", [guideId, group.group_id]);
  const students = await groupStudentIds(group.group_id);
  await notify(students, `${guide.name} has been allocated as your guide.`, "/group");
  await notify([guideId], `${group.group_no} has been allocated to you.`, "/groups");
  await logActivity(req.user.id, "allocate_guide", `${group.group_no} -> ${guide.name}`);

  const { rows } = await q(GROUP_SELECT + " WHERE g.group_id = $1", [group.group_id]);
  res.json(rows[0]);
});

// GET /api/groups/:id/result
router.get("/:id/result", async (req, res) => {
  const group = await getAccessibleGroup(req.user, req.params.id);
  if (req.user.role === "student" && !group.result_published) {
    throw new HttpError(403, "Result has not been published yet");
  }
  const { rows } = await q(
    `SELECT m.milestone_id, m.title, m.max_marks, m.status, r.marks, r.feedback
       FROM milestones m LEFT JOIN reviews r ON r.milestone_id = m.milestone_id
      WHERE m.group_id = $1 ORDER BY m.due_date, m.milestone_id`,
    [group.group_id]
  );
  const total = rows.reduce((s, r) => s + Number(r.marks || 0), 0);
  const max = rows.reduce((s, r) => s + Number(r.max_marks), 0);
  res.json({
    group_no: group.group_no,
    published: group.result_published,
    milestones: rows,
    total_marks: total,
    max_marks: max,
    percentage: max ? Math.round((total / max) * 1000) / 10 : 0,
    result: max && total / max >= 0.4 ? "Pass" : "Fail",
  });
});

// PUT /api/groups/:id/publish-result
router.put("/:id/publish-result", requireRole("coordinator"), async (req, res) => {
  const group = (await q("SELECT * FROM groups WHERE group_id = $1", [req.params.id])).rows[0];
  if (!group) throw new HttpError(404, "Group not found");
  const { rows } = await q(
    "SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'reviewed')::int AS done FROM milestones WHERE group_id = $1",
    [group.group_id]
  );
  if (!rows[0].total || rows[0].total !== rows[0].done) {
    throw new HttpError(409, "All milestones must be reviewed before publishing the result");
  }
  await q("UPDATE groups SET result_published = TRUE, status = 'completed' WHERE group_id = $1", [group.group_id]);
  await notify(await groupStudentIds(group.group_id), "Your final project result has been published.", "/result");
  await logActivity(req.user.id, "publish_result", group.group_no);
  res.json({ published: true });
});

export default router;
