import { useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Badge, Msg, Progress, useLoad } from "../ui.jsx";

export default function Groups() {
  const { user } = useAuth();
  const isCoord = user.role === "coordinator";
  const [groups, { error, reload }] = useLoad(() => api.get("/groups"));
  const [guides] = useLoad(() => (isCoord ? api.get("/users?role=guide") : Promise.resolve([])));
  const [pick, setPick] = useState({});
  const [err, setErr] = useState(""); const [ok, setOk] = useState("");

  const act = async (fn, okMsg) => {
    setErr(""); setOk("");
    try { await fn(); setOk(okMsg); reload(); } catch (x) { setErr(x.message); }
  };

  return (
    <>
      <h1>{isCoord ? "Groups" : "My Groups"}</h1>
      <Msg error={error || err} ok={ok} />
      {groups?.length === 0 && <div className="card empty">No groups yet.</div>}
      {groups?.map((g) => (
        <div className="card" key={g.group_id}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="row"><h2 style={{ margin: 0 }}>{g.group_no}</h2><Badge s={g.status} />{g.result_published && <span className="badge ok">Result published</span>}</div>
            <span className="muted">Guide: {g.guide_name || "—"}</span>
          </div>
          <p style={{ margin: "10px 0 4px" }}><b>Topic:</b> {g.topic_title || <span className="muted">not submitted</span>} {g.topic_status && <Badge s={g.topic_status} />}</p>
          <p style={{ margin: "4px 0" }}><b>Members:</b> {g.members.map((m) => `${m.name} (${m.roll_no})`).join(", ")}</p>
          {g.milestones_total > 0 && <div style={{ marginTop: 8 }}><Progress done={g.milestones_done} total={g.milestones_total} /></div>}
          {isCoord && (
            <div className="row" style={{ marginTop: 12 }}>
              {["topic_approved", "guide_allocated"].includes(g.status) && !g.result_published && <>
                <select style={{ width: 260 }} value={pick[g.group_id] ?? g.guide_id ?? ""} onChange={(e) => setPick({ ...pick, [g.group_id]: e.target.value })}>
                  <option value="">Select guide…</option>
                  {guides?.map((u) => <option key={u.user_id} value={u.user_id}>{u.name} ({u.allocated_groups}/{u.max_groups})</option>)}
                </select>
                <button className="sm" disabled={!(pick[g.group_id] ?? g.guide_id)} onClick={() => act(() => api.put(`/groups/${g.group_id}/allocate-guide`, { guide_id: Number(pick[g.group_id] ?? g.guide_id) }), `Guide allocated to ${g.group_no}.`)}>
                  {g.guide_id ? "Re-allocate" : "Allocate guide"}</button>
              </>}
              {g.status === "guide_allocated" && g.milestones_total > 0 && g.milestones_total === g.milestones_done && (
                <button className="sm" onClick={() => act(() => api.put(`/groups/${g.group_id}/publish-result`), `Result published for ${g.group_no}.`)}>Publish result</button>
              )}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
