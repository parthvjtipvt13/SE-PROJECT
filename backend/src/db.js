import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

export const DATABASE_URL =
  process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/projexhub";

export const pool = new pg.Pool({ connectionString: DATABASE_URL });

export const q = (text, params) => pool.query(text, params);

/** Run fn(client) inside a transaction. */
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function notify(userIds, message, link = null, client = pool) {
  const ids = [...new Set(userIds.filter(Boolean))];
  for (const id of ids) {
    await client.query(
      "INSERT INTO notifications (user_id, message, link) VALUES ($1,$2,$3)",
      [id, message, link]
    );
  }
}

export async function logActivity(userId, action, detail = null, client = pool) {
  await client.query(
    "INSERT INTO activity_log (user_id, action, detail) VALUES ($1,$2,$3)",
    [userId, action, detail]
  );
}
