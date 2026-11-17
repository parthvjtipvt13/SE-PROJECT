import { q } from "./db.js";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Returns the group row if the user may access it; throws otherwise. */
export async function getAccessibleGroup(user, groupId) {
  const { rows } = await q("SELECT * FROM groups WHERE group_id = $1", [groupId]);
  const group = rows[0];
  if (!group) throw new HttpError(404, "Group not found");
  if (user.role === "coordinator") return group;
  if (user.role === "guide" && group.guide_id === user.id) return group;
  if (user.role === "student") {
    const m = await q("SELECT 1 FROM group_members WHERE student_id = $1 AND group_id = $2", [user.id, groupId]);
    if (m.rowCount) return group;
  }
  throw new HttpError(403, "You do not have access to this group");
}

export async function getStudentGroup(userId) {
  const { rows } = await q(
    "SELECT g.* FROM groups g JOIN group_members m ON m.group_id = g.group_id WHERE m.student_id = $1",
    [userId]
  );
  return rows[0] || null;
}

export async function groupStudentIds(groupId) {
  const { rows } = await q("SELECT student_id FROM group_members WHERE group_id = $1", [groupId]);
  return rows.map((r) => r.student_id);
}

export async function coordinatorIds() {
  const { rows } = await q("SELECT user_id FROM users WHERE role = 'coordinator' AND status = 'active'");
  return rows.map((r) => r.user_id);
}

export function need(value, label) {
  if (value === undefined || value === null || String(value).trim() === "") {
    throw new HttpError(400, `${label} is required`);
  }
  return typeof value === "string" ? value.trim() : value;
}
