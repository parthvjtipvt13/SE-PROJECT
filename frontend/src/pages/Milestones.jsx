import { useEffect, useRef, useState } from "react";
import { api, downloadUrl } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Badge, Msg, fmtDate, fmtDateTime, useLoad } from "../ui.jsx";

export default function Milestones() {
  const { user } = useAuth();
  const [ms, { error, reload }] = useLoad(() => api.get("/milestones"));
  return (
    <>
      <h1>Milestones</h1>
      <Msg error={error} />
      {user.role === "coordinator" && <CreateMilestone onDone={reload} />}
      {ms?.length === 0 && <div className="card empty">{user.role === "student" ? "No milestones assigned yet. They appear once your guide is allocated." : "No milestones yet."}</div>}
      {user.role === "student" && ms?.map((m) => <StudentMilestone key={m.milestone_id} m={m} onChange={reload} />)}
      {user.role === "coordinator" && ms?.length > 0 && (
        <div className="card"><table>
          <thead><tr><th>Group</th><th>Milestone</th><th>Due</th><th>Marks</th><th>Status</th></tr></thead>
          <tbody>{ms.map((m) => (
            <tr key={m.milestone_id}><td>{m.group_no}</td><td>{m.title}</td><td>{fmtDate(m.due_date)}</td>
              <td>{m.marks ?? "–"} / {m.max_marks}</td><td><Badge s={m.status} />{m.overdue && <> <span className="badge bad">Overdue</span></>}</td></tr>
          ))}</tbody></table></div>
      )}
    </>
  );
}

function CreateMilestone({ onDone }) {
  const [groups] = useLoad(() => api.get("/groups"));
  const [f, setF] = useState({ title: "", due_date: "", max_marks: 25, group_id: "all" });
  const [err, setErr] = useState(""); const [ok, setOk] = useState("");
  const submit = async (e) => {
    e.preventDefault(); setErr(""); setOk("");
    try {
      const body = { title: f.title, due_date: f.due_date, max_marks: Number(f.max_marks) };
      if (f.group_id === "all") body.all_groups = true; else body.group_id = Number(f.group_id);
      const r = await api.post("/milestones", body);
      setOk(`Milestone created for ${r.length} group(s).`); setF({ ...f, title: "" }); onDone();
    } catch (x) { setErr(x.message); }
  };
  return (
    <form className="card" onSubmit={submit}>
      <h2>Create milestone</h2><Msg error={err} ok={ok} />
      <div className="row grow">
        <div><label>Title</label><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required /></div>
        <div><label>Due date</label><input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} required /></div>
        <div><label>Max marks</label><input type="number" min="1" max="100" value={f.max_marks} onChange={(e) => setF({ ...f, max_marks: e.target.value })} /></div>
        <div><label>Group</label>
          <select value={f.group_id} onChange={(e) => setF({ ...f, group_id: e.target.value })}>
            <option value="all">All approved groups</option>
            {groups?.map((g) => <option key={g.group_id} value={g.group_id}>{g.group_no}</option>)}
          </select></div>
      </div>
      <div style={{ height: 14 }} /><button>Create</button>
    </form>
  );
}

function StudentMilestone({ m, onChange }) {
  const [docs, setDocs] = useState([]);
  const [notes, setNotes] = useState(m.draft_notes || "");
  const [saved, setSaved] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const fileRef = useRef();
  const first = useRef(true);
  const locked = m.status === "reviewed";

  const loadDocs = () => api.get(`/documents?milestone_id=${m.milestone_id}`).then(setDocs).catch(() => {});
  useEffect(() => { loadDocs(); }, [m.milestone_id, m.status]);

  // draft auto-save (debounced 1.2s)
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (locked) return;
    setSaved("Saving…");
    const t = setTimeout(() => api.put(`/milestones/${m.milestone_id}/draft`, { draft_notes: notes })
      .then(() => setSaved("Draft saved " + new Date().toLocaleTimeString())).catch((e) => setSaved(e.message)), 1200);
    return () => clearTimeout(t);
  }, [notes]);

  const upload = async () => {
    const file = fileRef.current.files[0];
    if (!file) return setErr("Choose a file first");
    setBusy(true); setErr("");
    try {
      const fd = new FormData(); fd.append("milestone_id", m.milestone_id); fd.append("file", file);
      await api.post("/documents", fd);
      fileRef.current.value = ""; await loadDocs(); onChange();
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row"><h2 style={{ margin: 0 }}>{m.title}</h2><Badge s={m.status} />{m.overdue && <span className="badge bad">Overdue</span>}</div>
        <span className="muted">Due {fmtDate(m.due_date)} · {m.max_marks} marks</span>
      </div>
      {m.status === "reviewed" && <div className="msg ok" style={{ marginTop: 12 }}><b>{m.marks}/{m.max_marks}</b> — {m.feedback}</div>}
      {!locked && <>
        <label>Draft notes <span className="muted">(auto-saved)</span></label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Keep notes on what you're working on…" />
        <div className="muted">{saved}</div>
        <Msg error={err} />
        <div className="row" style={{ marginTop: 10 }}>
          <input type="file" ref={fileRef} style={{ width: "auto" }} />
          <button disabled={busy} onClick={upload}>{docs.length ? "Upload new version" : "Upload document"}</button>
        </div>
      </>}
      {docs.length > 0 && <table style={{ marginTop: 12 }}>
        <thead><tr><th>Version</th><th>File</th><th>Uploaded</th><th /></tr></thead>
        <tbody>{docs.map((d) => (
          <tr key={d.document_id}><td>v{d.version}</td><td>{d.file_name} <span className="muted">({Math.ceil(d.size_bytes / 1024)} KB)</span> {d.is_late && <span className="badge bad">Late</span>}</td>
            <td>{fmtDateTime(d.uploaded_at)} <span className="muted">by {d.uploaded_by}</span></td><td><a href={downloadUrl(d.document_id)}>Download</a></td></tr>
        ))}</tbody></table>}
    </div>
  );
}
