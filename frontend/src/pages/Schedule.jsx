import { useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Msg, fmtDateTime, useLoad } from "../ui.jsx";

export default function Schedule() {
  const { user } = useAuth();
  const canCreate = user.role !== "student";
  const [items, { error, reload }] = useLoad(() => api.get("/milestones/schedules/list"));
  const [groups] = useLoad(() => (canCreate ? api.get("/groups") : Promise.resolve([])));
  const [f, setF] = useState({ group_id: "", title: "", start_time: "", end_time: "" });
  const [err, setErr] = useState(""); const [ok, setOk] = useState("");

  const submit = async (e) => {
    e.preventDefault(); setErr(""); setOk("");
    try { await api.post("/milestones/schedules", { ...f, group_id: Number(f.group_id) }); setOk("Slot scheduled."); reload(); }
    catch (x) { setErr(x.message); }
  };
  return (
    <>
      <h1>Schedule</h1><Msg error={error} />
      {canCreate && (
        <form className="card" onSubmit={submit}>
          <h2>Schedule a review / presentation</h2><Msg error={err} ok={ok} />
          <div className="row grow">
            <div><label>Group</label><select value={f.group_id} onChange={(e) => setF({ ...f, group_id: e.target.value })} required>
              <option value="">Select…</option>{groups?.map((g) => <option key={g.group_id} value={g.group_id}>{g.group_no}</option>)}</select></div>
            <div><label>Title</label><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required /></div>
            <div><label>Start</label><input type="datetime-local" value={f.start_time} onChange={(e) => setF({ ...f, start_time: e.target.value })} required /></div>
            <div><label>End</label><input type="datetime-local" value={f.end_time} onChange={(e) => setF({ ...f, end_time: e.target.value })} required /></div>
          </div>
          <div style={{ height: 14 }} /><button>Schedule</button>
        </form>
      )}
      <div className="card">
        {items?.length === 0 ? <div className="empty">Nothing scheduled.</div> : (
          <table><thead><tr><th>Group</th><th>Title</th><th>Start</th><th>End</th></tr></thead>
            <tbody>{items?.map((s) => <tr key={s.schedule_id}><td>{s.group_no}</td><td>{s.title}</td><td>{fmtDateTime(s.start_time)}</td><td>{fmtDateTime(s.end_time)}</td></tr>)}</tbody></table>
        )}
      </div>
    </>
  );
}
