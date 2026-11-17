import { Router } from "express";
import { q } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const { rows } = await q(
    "SELECT notification_id, message, link, is_read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC, notification_id DESC LIMIT 100",
    [req.user.id]
  );
  const unread = (await q("SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND NOT is_read", [req.user.id])).rows[0].n;
  res.json({ unread, items: rows });
});

router.put("/read-all", async (req, res) => {
  await q("UPDATE notifications SET is_read = TRUE WHERE user_id = $1", [req.user.id]);
  res.json({ ok: true });
});

router.put("/:id/read", async (req, res) => {
  await q("UPDATE notifications SET is_read = TRUE WHERE notification_id = $1 AND user_id = $2", [req.params.id, req.user.id]);
  res.json({ ok: true });
});

export default router;
