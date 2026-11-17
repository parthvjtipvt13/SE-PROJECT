import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { HttpError } from "./access.js";
import auth from "./routes/auth.js";
import users from "./routes/users.js";
import groups from "./routes/groups.js";
import topics from "./routes/topics.js";
import milestones from "./routes/milestones.js";
import documents from "./routes/documents.js";
import reviews from "./routes/reviews.js";
import notifications from "./routes/notifications.js";
import dashboard from "./routes/dashboard.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", auth);
app.use("/api/users", users);
app.use("/api/groups", groups);
app.use("/api/topics", topics);
app.use("/api/milestones", milestones);
app.use("/api/documents", documents);
app.use("/api/reviews", reviews);
app.use("/api/notifications", notifications);
app.use("/api/dashboard", dashboard);

app.use("/api", (_req, _res) => {
  throw new HttpError(404, "Route not found");
});

// Serve the built frontend (npm run build in /frontend) if present
const dist = path.resolve(__dirname, "../../frontend/dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err?.name === "MulterError") {
    return res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "File is too large (max 20 MB)" : err.message });
  }
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON body" });
  if (err?.code === "23505") return res.status(409).json({ error: "Duplicate entry" });
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server" });
});

export default app;
