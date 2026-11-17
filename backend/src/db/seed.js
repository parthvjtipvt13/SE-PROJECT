import bcrypt from "bcryptjs";

const DEMO = {
  coordinator: { name: "Prof. Anita Deshmukh (HOD)", email: "coordinator@projexhub.dev", password: "Coord@123" },
  guides: [
    { name: "Dr. Rajesh Mehra", email: "guide1@projexhub.dev", department: "Information Technology" },
    { name: "Dr. Sunita Kulkarni", email: "guide2@projexhub.dev", department: "Information Technology" },
    { name: "Prof. Amit Joshi", email: "guide3@projexhub.dev", department: "Computer Engineering" },
  ],
  guidePassword: "Guide@123",
  teamStudents: [
    { name: "Devansh Mehta", roll_no: "241080038", email: "devansh@projexhub.dev" },
    { name: "Rehan Mehta", roll_no: "241080039", email: "rehan@projexhub.dev" },
    { name: "Tanush Lokhande", roll_no: "241080035", email: "tanush@projexhub.dev" },
    { name: "Parth Madrewar", roll_no: "241080036", email: "parth@projexhub.dev" },
  ],
  freeStudents: [
    { name: "Aarav Shah", roll_no: "241080101", email: "aarav@projexhub.dev" },
    { name: "Isha Patil", roll_no: "241080102", email: "isha@projexhub.dev" },
    { name: "Kabir Nair", roll_no: "241080103", email: "kabir@projexhub.dev" },
    { name: "Meera Iyer", roll_no: "241080104", email: "meera@projexhub.dev" },
  ],
  studentPassword: "Student@123",
};

const plusDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Seeds demo data. Does nothing if users already exist. */
export async function seed(pool) {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM users");
  if (rows[0].n > 0) {
    console.log("Seed skipped: users already exist.");
    return false;
  }

  const hash = (p) => bcrypt.hashSync(p, 10);
  const insertUser = async (u, role, pw, extra = {}) => {
    const r = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, roll_no, department, max_groups)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING user_id`,
      [u.name, u.email, hash(pw), role, u.roll_no || null, u.department || extra.department || null, u.max_groups || 4]
    );
    return r.rows[0].user_id;
  };

  await insertUser(DEMO.coordinator, "coordinator", DEMO.coordinator.password, { department: "Information Technology" });
  const guideIds = [];
  for (const g of DEMO.guides) guideIds.push(await insertUser(g, "guide", DEMO.guidePassword));
  const teamIds = [];
  for (const s of DEMO.teamStudents) teamIds.push(await insertUser(s, "student", DEMO.studentPassword, { department: "Information Technology" }));
  for (const s of DEMO.freeStudents) await insertUser(s, "student", DEMO.studentPassword, { department: "Information Technology" });

  // Demo group: the ProjexHub team, topic approved, guide allocated, tasks created
  const g = await pool.query(
    "INSERT INTO groups (guide_id, status) VALUES ($1,'guide_allocated') RETURNING group_id",
    [guideIds[0]]
  );
  const gid = g.rows[0].group_id;
  await pool.query("UPDATE groups SET group_no = 'Group ' || group_id WHERE group_id = $1", [gid]);
  for (const sid of teamIds) await pool.query("INSERT INTO group_members (student_id, group_id) VALUES ($1,$2)", [sid, gid]);
  await pool.query(
    `INSERT INTO topics (group_id, title, abstract, status, remark, reviewed_at)
     VALUES ($1,$2,$3,'approved','Good scope. Approved.', NOW())`,
    [gid, "ProjexHub - A Centralized B.Tech Project Management System",
     "A web platform to manage group registration, topic approval, guide allocation, task submissions, reviews and results for final-year B.Tech projects."]
  );
  const ms = [
    ["Synopsis Submission", plusDays(7)],
    ["Mid-Term Review", plusDays(30)],
    ["Final Report", plusDays(60)],
    ["Final Presentation & Demo", plusDays(75)],
  ];
  for (const [title, due] of ms) {
    await pool.query("INSERT INTO milestones (group_id, title, due_date, max_marks) VALUES ($1,$2,$3,25)", [gid, title, due]);
  }

  console.log("Seeded demo data.");
  console.log("  Coordinator : coordinator@projexhub.dev / " + DEMO.coordinator.password);
  console.log("  Guide       : guide1@projexhub.dev / " + DEMO.guidePassword + "  (guide2, guide3 also)");
  console.log("  Student     : rehan@projexhub.dev / " + DEMO.studentPassword + "  (devansh, tanush, parth in Group 1)");
  console.log("  Ungrouped   : aarav / isha / kabir / meera @projexhub.dev / " + DEMO.studentPassword);
  return true;
}
