import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { DATABASE_URL, pool } from "../db.js";
import { seed } from "./seed.js";

const here = path.dirname(fileURLToPath(import.meta.url));
function explain(e) {
  const code = e.code || e.errors?.[0]?.code;
  if (code === "ECONNREFUSED") return "Cannot reach PostgreSQL on the host/port in DATABASE_URL. Is PostgreSQL installed and running (Windows: Services -> postgresql-x64-NN), and is the port right (default 5432)?";
  if (code === "28P01") return "Wrong PostgreSQL username/password. Fix DATABASE_URL in backend/.env.";
  return e.message || String(e);
}
const reset = process.argv.includes("--reset");

async function ensureDatabase() {
  const url = new URL(DATABASE_URL);
  const dbName = url.pathname.replace("/", "");
  const admin = new pg.Client({ connectionString: DATABASE_URL.replace(`/${dbName}`, "/postgres") });
  try {
    await admin.connect();
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (!exists.rowCount) {
      await admin.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Created database "${dbName}".`);
    }
  } catch (e) {
    console.warn("Could not auto-create the database: " + explain(e));
  } finally {
    await admin.end().catch(() => {});
  }
}

async function main() {
  await ensureDatabase();
  if (reset) {
    await pool.query(`DROP TABLE IF EXISTS activity_log, notifications, schedules, reviews, documents,
      milestones, topics, group_members, groups, users CASCADE`);
    console.log("Dropped existing tables.");
  }
  const sql = fs.readFileSync(path.join(here, "schema.sql"), "utf8");
  await pool.query(sql);
  console.log("Schema ready.");
  await seed(pool);
  await pool.end();
}

main().catch((e) => {
  console.error("Setup failed:", explain(e));
  process.exit(1);
});
