import { useState } from "react";
import { api } from "../api.js";
import { Badge, Msg, fmtDate, useLoad } from "../ui.jsx";

export default function Topic() {
  const [group] = useLoad(() => api.get("/groups/mine"));
  const [topics, { error, reload }] = useLoad(() => api.get("/topics"));
  const [f, setF] = useState({ title: "", abstract: "" });
  const [err, setErr] = useState(""); const [ok, setOk] = useState("");
  const current = topics?.[0];
  const locked = group && ["topic_approved", "guide_allocated", "completed"].includes(group.status);
  const canSubmit = group && !locked && current?.status !== "pending";

  const submit = async (e) => {
    e.preventDefault(); setErr(""); setOk("");
    try { await api.post("/topics", f); setOk("Topic submitted for approval."); setF({ title: "", abstract: "" }); reload(); }
    catch (x) { setErr(x.message); }
  };

  return (
    <>
      <h1>Project Topic</h1>
      <Msg error={error} />
      {group === null && <div className="msg err">Create a group first (My Group).</div>}
      {current && (
        <div className="card">
          <div className="row"><h2 style={{ margin: 0 }}>{current.title}</h2><Badge s={current.status} /></div>
          <p>{current.abstract}</p>
          <div className="muted">Submitted {fmtDate(current.submitted_at)}</div>
          {current.remark && <div className="msg" style={{ background: "#fdf0d5", marginTop: 10 }}><b>Coordinator remark:</b> {current.remark}</div>}
        </div>
      )}
      {canSubmit && (
        <form className="card" onSubmit={submit}>
          <h2>{current ? "Submit a revised topic" : "Submit your project topic"}</h2>
          <Msg error={err} ok={ok} />
          <label>Title</label><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required maxLength={200} />
          <label>Abstract</label><textarea value={f.abstract} onChange={(e) => setF({ ...f, abstract: e.target.value })} required minLength={30} />
          <div style={{ height: 14 }} /><button>Submit for approval</button>
        </form>
      )}
      {current?.status === "pending" && <p className="muted">Waiting for the coordinator to review your topic.</p>}
    </>
  );
}
