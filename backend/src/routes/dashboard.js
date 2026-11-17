import { Router } from "express";
import { q } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { getStudentGroup } from "../access.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const { role, id } = req.user;

  if (role === "coordinator") {
    const one = async (sql) => (await q(sql)).rows[0];
    const totals = await one(`SELECT
        (SELECT COUNT(*)::int FROM users WHERE role='student') AS students,
        (SELECT COUNT(*)::int FROM users WHERE role='guide') AS guides,
        (SELECT COUNT(*)::int FROM groups) AS groups,
        (SELECT COUNT(*)::int FROM topics WHERE status='pending') AS pending_topics,
        (SELECT COUNT(*)::int FROM groups WHERE status='topic_approved') AS awaiting_guide,
        (SELECT COUNT(*)::int FROM groups WHERE result_published) AS results_published,
        (SELECT COUNT(*)::int FROM milestones WHERE status='pending' AND due_date < CURRENT_DATE) AS overdue_milestones,
        (SELECT COUNT(*)::int FROM users u WHERE u.role='student' AND NOT EXISTS (SELECT 1 FROM group_members m WHERE m.student_id=u.user_id)) AS ungrouped_students`);
    const byStatus = (await q("SELECT status, COUNT(*)::int AS count FROM groups GROUP BY status ORDER BY status")).rows;
    const workload = (await q(
      `SELECT u.user_id, u.name, u.max_groups, COUNT(g.group_id)::int AS allocated
         FROM users u LEFT JOIN groups g ON g.guide_id = u.user_id
        WHERE u.role='guide' AND u.status='active' GROUP BY u.user_id ORDER BY u.name`)).rows;
    return res.json({ role, totals, byStatus, workload });
  }

  if (role === "guide") {
    const stats = (await q(
      `SELECT (SELECT COUNT(*)::int FROM groups WHERE guide_id=$1) AS groups,
              (SELECT COUNT(*)::int FROM milestones m JOIN groups g ON g.group_id=m.group_id WHERE g.guide_id=$1 AND m.status='submitted') AS to_review,
              (SELECT COUNT(*)::int FROM milestones m JOIN groups g ON g.group_id=m.group_id WHERE g.guide_id=$1 AND m.status='reviewed') AS reviewed,
              (SELECT COUNT(*)::int FROM milestones m JOIN groups g ON g.group_id=m.group_id WHERE g.guide_id=$1 AND m.status='pending' AND m.due_date < CURRENT_DATE) AS overdue`,
      [id])).rows[0];
    const groups = (await q(
      `SELECT g.group_id, g.group_no, g.status,
              (SELECT COUNT(*)::int FROM milestones WHERE group_id=g.group_id) AS total,
              (SELECT COUNT(*)::int FROM milestones WHERE group_id=g.group_id AND status='reviewed') AS done
         FROM groups g WHERE g.guide_id=$1 ORDER BY g.group_id`, [id])).rows;
    return res.json({ role, stats, groups });
  }

  const group = await getStudentGroup(id);
  if (!group) return res.json({ role, group: null });
  const ms = (await q(
    `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='reviewed')::int AS done,
            COUNT(*) FILTER (WHERE status='pending' AND due_date < CURRENT_DATE)::int AS overdue
       FROM milestones WHERE group_id=$1`, [group.group_id])).rows[0];
  const next = (await q(
    "SELECT milestone_id, title, due_date, status FROM milestones WHERE group_id=$1 AND status <> 'reviewed' ORDER BY due_date LIMIT 1",
    [group.group_id])).rows[0] || null;
  res.json({ role, group: { group_id: group.group_id, group_no: group.group_no, status: group.status, result_published: group.result_published }, milestones: ms, next });
});

export default router;
