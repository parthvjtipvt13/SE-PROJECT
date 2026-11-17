import { useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Msg, useLoad } from "../ui.jsx";

export default function Users() {
  const { user } = useAuth();
  const [users, { error, reload }] = useLoad(() => api.get("/users"));
  const [f, setF] = useState({ name: "", email: "", password: "", role: "guide", roll_no: "", max_groups: 4 });
  const [err, setErr] = useState(""); const [ok, setOk] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const create = async (e) => {
    e.preventDefault(); setErr(""); setOk("");
    try { await api.post("/users", { ...f, max_groups: Number(f.max_groups) }); setOk("User created."); setF({ ...f, name: "", email: "", password: "", roll_no: "" }); reload(); }
    catch (x) { setErr(x.message); }
  };
  const toggle = async (u) => {
    try { await api.put(`/users/${u.user_id}/status`, { status: u.status === "active" ? "inactive" : "active" }); reload(); } catch (x) { setErr(x.message); }
  };

  return (
    <>
      <h1>Users</h1><Msg error={error} />
      <form className="card" onSubmit={create}>
        <h2>Add user</h2><Msg error={err} ok={ok} />
        <div className="row grow">
          <div><label>Name</label><input value={f.name} onChange={set("name")} required /></div>
          <div><label>Email</label><input type="email" value={f.email} onChange={set("email")} required /></div>
          <div><label>Password</label><input type="password" minLength={8} value={f.password} onChange={set("password")} required /></div>
        </div>
        <div className="row grow">
          <div><label>Role</label><select value={f.role} onChange={set("role")}><option value="guide">Guide</option><option value="student">Student</option><option value="coordinator">Coordinator</option></select></div>
          {f.role === "student" && <div><label>Roll number</label><input value={f.roll_no} onChange={set("roll_no")} required /></div>}
          {f.role === "guide" && <div><label>Max groups</label><input type="number" min="1" value={f.max_groups} onChange={set("max_groups")} /></div>}
        </div>
        <div style={{ height: 14 }} /><button>Create user</button>
      </form>
      <div className="card"><table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Roll no.</th><th>Load</th><th>Status</th><th /></tr></thead>
        <tbody>{users?.map((u) => (
          <tr key={u.user_id}><td>{u.name}</td><td>{u.email}</td><td style={{ textTransform: "capitalize" }}>{u.role}</td><td>{u.roll_no || "—"}</td>
            <td>{u.role === "guide" ? `${u.allocated_groups}/${u.max_groups}` : "—"}</td>
            <td><span className={`badge ${u.status === "active" ? "ok" : "bad"}`}>{u.status}</span></td>
            <td>{u.user_id !== user.id && <button className="ghost sm" onClick={() => toggle(u)}>{u.status === "active" ? "Deactivate" : "Activate"}</button>}</td></tr>
        ))}</tbody></table></div>
    </>
  );
}
