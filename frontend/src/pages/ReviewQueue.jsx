import { useState } from "react";
import { api, downloadUrl } from "../api.js";
import { Badge, Msg, fmtDate, useLoad } from "../ui.jsx";

export default function ReviewQueue() {
  const [q, { error, reload }] = useLoad(() => api.get("/reviews/queue"));
  return (
    <>
      <h1>Review Queue</h1><Msg error={error} />
      {q?.length === 0 && <div className="card empty">Nothing waiting for review.</div>}
      {q?.map((m) => <ReviewCard key={m.milestone_id} m={m} onDone={reload} />)}
    </>
  );
}

function ReviewCard({ m, onDone }) {
  const [docs] = useLoad(() => api.get(`/documents?milestone_id=${m.milestone_id}`), [m.milestone_id]);
  const [marks, setMarks] = useState(""); const [feedback, setFeedback] = useState(""); const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault(); setErr("");
    try { await api.post("/reviews", { milestone_id: m.milestone_id, marks: Number(marks), feedback }); onDone(); }
    catch (x) { setErr(x.message); }
  };
  return (
    <form className="card" onSubmit={submit}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row"><h2 style={{ margin: 0 }}>{m.group_no} — {m.title}</h2>{m.is_late && <span className="badge bad">Late</span>}</div>
        <span className="muted">Due {fmtDate(m.due_date)}</span>
      </div>
      <table style={{ marginTop: 8 }}><tbody>{docs?.map((d) => (
        <tr key={d.document_id}><td>v{d.version}</td><td>{d.file_name}</td><td><a href={downloadUrl(d.document_id)}>Download</a></td></tr>
      ))}</tbody></table>
      <Msg error={err} />
      <div className="row grow">
        <div style={{ maxWidth: 160 }}><label>Marks (out of {m.max_marks})</label><input type="number" step="0.5" min="0" max={m.max_marks} value={marks} onChange={(e) => setMarks(e.target.value)} required /></div>
        <div style={{ flex: 3 }}><label>Feedback</label><input value={feedback} onChange={(e) => setFeedback(e.target.value)} required /></div>
      </div>
      <div style={{ height: 14 }} /><button>Submit review</button>
    </form>
  );
}
