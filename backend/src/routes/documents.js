import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { q, tx, notify, logActivity } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError, getAccessibleGroup, need } from "../access.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = new Set([".pdf", ".doc", ".docx", ".ppt", ".pptx", ".zip", ".txt", ".md", ".png", ".jpg", ".jpeg"]);
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(path.extname(file.originalname).toLowerCase())) {
      return cb(new HttpError(400, "File type not allowed (pdf, doc/docx, ppt/pptx, zip, txt, md, png, jpg)"));
    }
    cb(null, true);
  },
});

const router = Router();
router.use(requireAuth);

async function loadMilestone(user, id) {
  const m = (await q("SELECT m.*, g.guide_id, g.group_no FROM milestones m JOIN groups g ON g.group_id = m.group_id WHERE m.milestone_id = $1", [id])).rows[0];
  if (!m) throw new HttpError(404, "Milestone not found");
  await getAccessibleGroup(user, m.group_id);
  return m;
}

// GET /api/documents?milestone_id=
router.get("/", async (req, res) => {
  const m = await loadMilestone(req.user, need(req.query.milestone_id, "milestone_id"));
  const { rows } = await q(
    `SELECT d.document_id, d.file_name, d.size_bytes, d.version, d.is_late, d.uploaded_at, u.name AS uploaded_by
       FROM documents d LEFT JOIN users u ON u.user_id = d.uploaded_by
      WHERE d.milestone_id = $1 ORDER BY d.version DESC`,
    [m.milestone_id]
  );
  res.json(rows);
});

// POST /api/documents  multipart: milestone_id, file   (student)
router.post("/", requireRole("student"), upload.single("file"), async (req, res) => {
  const file = req.file;
  try {
    if (!file) throw new HttpError(400, "Please choose a file to upload");
    const m = await loadMilestone(req.user, need(req.body.milestone_id, "milestone_id"));
    if (m.status === "reviewed") throw new HttpError(409, "This milestone has already been reviewed; no more uploads");

    const doc = await tx(async (c) => {
      await c.query("SELECT 1 FROM milestones WHERE milestone_id = $1 FOR UPDATE", [m.milestone_id]); // serialise concurrent uploads
      const v = (await c.query("SELECT COALESCE(MAX(version),0)+1 AS v FROM documents WHERE milestone_id = $1", [m.milestone_id])).rows[0].v;
      const late = new Date(m.due_date).setHours(23, 59, 59, 999) < Date.now();
      const d = (await c.query(
        `INSERT INTO documents (milestone_id, file_name, stored_name, size_bytes, version, is_late, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING document_id, file_name, size_bytes, version, is_late, uploaded_at`,
        [m.milestone_id, file.originalname, file.filename, file.size, v, late, req.user.id]
      )).rows[0];
      await c.query("UPDATE milestones SET status = 'submitted' WHERE milestone_id = $1", [m.milestone_id]);
      if (m.guide_id) await notify([m.guide_id], `${m.group_no} uploaded "${m.title}" (v${v}${late ? ", late" : ""}).`, "/review", c);
      await logActivity(req.user.id, "upload_document", `${m.group_no} / ${m.title} v${v}`, c);
      return d;
    });
    res.status(201).json(doc);
  } catch (e) {
    if (file) fs.unlink(file.path, () => {});
    throw e;
  }
});

// GET /api/documents/:id/download
router.get("/:id/download", async (req, res) => {
  const d = (await q("SELECT * FROM documents WHERE document_id = $1", [req.params.id])).rows[0];
  if (!d) throw new HttpError(404, "Document not found");
  await loadMilestone(req.user, d.milestone_id);
  const full = path.join(UPLOAD_DIR, d.stored_name);
  if (!fs.existsSync(full)) throw new HttpError(404, "File is missing on the server");
  res.download(full, d.file_name);
});

export default router;
