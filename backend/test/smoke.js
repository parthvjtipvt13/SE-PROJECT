// End-to-end smoke test: runs the full project lifecycle against the real API + database.
// Usage: npm run db:reset && npm test
import "dotenv/config";
import assert from "node:assert/strict";
import app from "../src/app.js";
import { pool } from "../src/db.js";

const server = app.listen(0);
const base = `http://localhost:${server.address().port}/api`;
let passed = 0;

async function call(method, url, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(base + url, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("json") ? await res.json() : null;
  return { status: res.status, data };
}
const ok = (name) => { passed++; console.log("  ✓", name); };
const login = async (email, password) => (await call("POST", "/auth/login", { body: { email, password } })).data.token;

try {
  console.log("ProjexHub smoke test");
  const coord = await login("coordinator@projexhub.dev", "Coord@123");
  const guide2 = await login("guide2@projexhub.dev", "Guide@123");
  const guide1 = await login("guide1@projexhub.dev", "Guide@123");
  ok("seeded users can log in");

  assert.equal((await call("POST", "/auth/login", { body: { email: "x@y.z", password: "nope" } })).status, 401);
  assert.equal((await call("GET", "/groups")).status, 401);
  ok("bad login and unauthenticated access rejected");

  // register two students and create a group
  const rA = await call("POST", "/auth/register", { body: { name: "Test A", email: "ta@t.dev", roll_no: "999001", password: "Password1" } });
  const rB = await call("POST", "/auth/register", { body: { name: "Test B", email: "tb@t.dev", roll_no: "999002", password: "Password1" } });
  assert.equal(rA.status, 201); assert.equal(rB.status, 201);
  assert.equal((await call("POST", "/auth/register", { body: { name: "Dup", email: "ta@t.dev", roll_no: "999003", password: "Password1" } })).status, 409);
  const a = rA.data.token, b = rB.data.token;
  ok("student registration + duplicate check");

  assert.equal((await call("POST", "/groups", { token: a, body: { member_roll_nos: ["000000"] } })).status, 400);
  const g = await call("POST", "/groups", { token: a, body: { member_roll_nos: ["999002"] } });
  assert.equal(g.status, 201); assert.equal(g.data.members.length, 2);
  const gid = g.data.group_id;
  assert.equal((await call("POST", "/groups", { token: b, body: { member_roll_nos: [] } })).status, 409);
  ok("group creation, unknown roll rejected, one-group-per-student enforced");

  // topic flow
  assert.equal((await call("POST", "/groups/" + gid + "/allocate-guide", { token: coord, body: {} })).status, 404);
  assert.equal((await call("PUT", `/groups/${gid}/allocate-guide`, { token: coord, body: { guide_id: 2 } })).status, 409);
  ok("guide cannot be allocated before topic approval");

  assert.equal((await call("POST", "/topics", { token: a, body: { title: "ProjexHub - A Centralized B.Tech Project Management System", abstract: "A duplicate of the seeded topic which must be rejected as duplicate." } })).status, 409);
  const t = await call("POST", "/topics", { token: a, body: { title: "Smart Library Tracker", abstract: "A system that tracks library books, fines and reservations for students." } });
  assert.equal(t.status, 201);
  assert.equal((await call("PUT", `/topics/${t.data.topic_id}/review`, { token: a, body: { status: "approved" } })).status, 403);
  assert.equal((await call("PUT", `/topics/${t.data.topic_id}/review`, { token: coord, body: { status: "rejected" } })).status, 400);
  const chg = await call("PUT", `/topics/${t.data.topic_id}/review`, { token: coord, body: { status: "changes_requested", remark: "Narrow the scope." } });
  assert.equal(chg.status, 200);
  const t2 = await call("POST", "/topics", { token: a, body: { title: "Smart Library Tracker v2", abstract: "Narrowed: tracks only book issue/return and fines for one department." } });
  assert.equal(t2.status, 201);
  assert.equal((await call("PUT", `/topics/${t2.data.topic_id}/review`, { token: coord, body: { status: "approved" } })).status, 200);
  assert.equal((await call("PUT", `/topics/${t2.data.topic_id}/review`, { token: coord, body: { status: "approved" } })).status, 409);
  ok("topic submit → changes requested → resubmit → approve (+ duplicate, role, remark rules)");

  // guide allocation with load limit
  const guides = (await call("GET", "/users?role=guide", { token: coord })).data;
  const g2 = guides.find((x) => x.email === "guide2@projexhub.dev");
  const alloc = await call("PUT", `/groups/${gid}/allocate-guide`, { token: coord, body: { guide_id: g2.user_id } });
  assert.equal(alloc.status, 200); assert.equal(alloc.data.status, "guide_allocated");
  ok("guide allocated");

  // milestones
  const due = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
  const ms = await call("POST", "/milestones", { token: coord, body: { title: "Synopsis", due_date: due, max_marks: 20, group_id: gid } });
  assert.equal(ms.status, 201);
  const mid = ms.data[0].milestone_id;
  assert.equal((await call("PUT", `/milestones/${mid}/draft`, { token: a, body: { draft_notes: "work in progress" } })).status, 200);
  assert.equal((await call("PUT", `/milestones/${mid}/draft`, { token: guide1, body: { draft_notes: "x" } })).status, 403);
  ok("milestone created, draft auto-save, role guard");

  // review before upload must fail
  assert.equal((await call("POST", "/reviews", { token: guide2, body: { milestone_id: mid, marks: 10, feedback: "ok" } })).status, 409);

  // upload twice -> versions 1, 2
  const up = async (name) => {
    const f = new FormData();
    f.append("milestone_id", mid);
    f.append("file", new Blob(["hello " + name]), name);
    return call("POST", "/documents", { token: b, form: f });
  };
  const u1 = await up("synopsis.pdf"), u2 = await up("synopsis_v2.pdf");
  assert.equal(u1.status, 201); assert.equal(u1.data.version, 1);
  assert.equal(u2.data.version, 2);
  const bad = new FormData(); bad.append("milestone_id", mid); bad.append("file", new Blob(["x"]), "virus.exe");
  assert.equal((await call("POST", "/documents", { token: b, form: bad })).status, 400);
  const list = await call("GET", `/documents?milestone_id=${mid}`, { token: a });
  assert.equal(list.data.length, 2);
  assert.equal((await call("GET", `/documents?milestone_id=${mid}`, { token: guide1 })).status, 403);
  const dl = await fetch(`${base}/documents/${u2.data.document_id}/download?token=${g2.user_id && guide2}`);
  assert.equal(dl.status, 200); assert.equal(await dl.text(), "hello synopsis_v2.pdf");
  ok("document upload versioning, type filter, access control, download");

  // review
  assert.equal((await call("POST", "/reviews", { token: guide1, body: { milestone_id: mid, marks: 10, feedback: "x" } })).status, 403);
  assert.equal((await call("POST", "/reviews", { token: guide2, body: { milestone_id: mid, marks: 99, feedback: "x" } })).status, 400);
  const queue = await call("GET", "/reviews/queue", { token: guide2 });
  assert.equal(queue.data.length, 1);
  assert.equal((await call("POST", "/reviews", { token: guide2, body: { milestone_id: mid, marks: 18, feedback: "Good synopsis." } })).status, 201);
  assert.equal((await call("POST", "/reviews", { token: guide2, body: { milestone_id: mid, marks: 18, feedback: "again" } })).status, 409);
  assert.equal((await up("late.pdf")).status, 409);
  ok("review: only allocated guide, marks bounds, single review, uploads locked after review");

  // result
  assert.equal((await call("GET", `/groups/${gid}/result`, { token: a })).status, 403);
  assert.equal((await call("PUT", `/groups/${gid}/publish-result`, { token: guide2 })).status, 403);
  const pub = await call("PUT", `/groups/${gid}/publish-result`, { token: coord });
  assert.equal(pub.status, 200);
  const res = await call("GET", `/groups/${gid}/result`, { token: a });
  assert.equal(res.data.total_marks, 18); assert.equal(res.data.max_marks, 20); assert.equal(res.data.result, "Pass");
  ok("result hidden until published, then correct totals");

  // notifications + dashboards
  const n = await call("GET", "/notifications", { token: a });
  assert.ok(n.data.unread > 0);
  await call("PUT", "/notifications/read-all", { token: a });
  assert.equal((await call("GET", "/notifications", { token: a })).data.unread, 0);
  for (const [tk, role] of [[a, "student"], [guide2, "guide"], [coord, "coordinator"]]) {
    const d = await call("GET", "/dashboard", { token: tk });
    assert.equal(d.status, 200); assert.equal(d.data.role, role);
  }
  assert.equal((await call("GET", "/users/activity/log", { token: coord })).status, 200);
  assert.equal((await call("GET", "/users", { token: a })).status, 403);
  ok("notifications, dashboards for all roles, activity log, coordinator-only routes");

  console.log(`\nAll ${passed} checks passed.`);
} catch (e) {
  console.error("\nFAILED:", e);
  process.exitCode = 1;
} finally {
  server.close();
  await pool.end();
}
