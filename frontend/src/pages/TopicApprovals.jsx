import { useState } from "react";
import { api } from "../api.js";
import { Badge, Msg, fmtDate, useLoad } from "../ui.jsx";

export default function TopicApprovals() {
  const [topics, { error, reload }] = useLoad(() => api.get("/topics"));
  const pending = topics?.filter((t) => t.status === "pending") || [];
  const done = topics?.filter((t) => t.status !== "pending") || [];
  return (
    <>
      <h1>Topic Approvals</h1><Msg error={error} />
      {pending.length === 0 && <div className="card empty">No topics waiting for approval.</div>}
      {pending.map((t) => <Review key={t.topic_id} t={t} onDone={reload} />)}
      {done.length > 0 && <div className="card"><h2>Reviewed</h2>
        <table><thead><tr><th>Group</th><th>Title</th><th>Status</th><th>Remark</th></tr></thead>
          <tbody>{done.map((t) => <tr key={t.topic_id}><td>{t.group_no}</td><td>{t.title}</td><td><Badge s={t.status} /></td><td>{t.remark}</td></tr>)}</tbody></table></div>}
    </>
  );
}

function Review({ t, onDone }) {
  const [remark, setRemark] = useState(""); const [err, setErr] = useState("");
  const decide = async (status) => {
    setErr("");
    try { await api.put(`/topics/${t.topic_id}/review`, { status, remark }); onDone(); } catch (x) { setErr(x.message); }
  };
  return (
    <div className="card">
      <div className="row"><h2 style={{ margin: 0 }}>{t.title}</h2><span className="muted">{t.group_no} · {fmtDate(t.submitted_at)}</span></div>
      <p>{t.abstract}</p><Msg error={err} />
      <label>Remark (required unless approving)</label><input value={remark} onChange={(e) => setRemark(e.target.value)} />
      <div className="row" style={{ marginTop: 12 }}>
        <button onClick={() => decide("approved")}>Approve</button>
        <button className="ghost" onClick={() => decide("changes_requested")}>Request changes</button>
        <button className="danger" onClick={() => decide("rejected")}>Reject</button>
      </div>
    </div>
  );
}
