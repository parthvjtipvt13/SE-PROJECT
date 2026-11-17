import { api } from "../api.js";
import { Badge, Msg, useLoad } from "../ui.jsx";

export default function Result() {
  const [r, { loading, error }] = useLoad(async () => {
    const g = await api.get("/groups/mine");
    if (!g) return { none: true };
    try { return await api.get(`/groups/${g.group_id}/result`); }
    catch (e) { if (e.status === 403) return { hidden: true }; throw e; }
  });
  return (
    <>
      <h1>Final Result</h1>
      <Msg error={error} />
      {loading && !r && <div className="empty">Loading…</div>}
      {r?.none && <div className="card empty">You are not in a group yet.</div>}
      {r?.hidden && <div className="card empty">Your result has not been published yet. You'll be notified when it is.</div>}
      {r?.milestones && (
        <div className="card">
          <div className="row"><h2 style={{ margin: 0 }}>{r.group_no}</h2><Badge s={r.result === "Pass" ? "approved" : "rejected"}>{r.result}</Badge></div>
          <table style={{ marginTop: 12 }}>
            <thead><tr><th>Milestone</th><th>Marks</th><th>Feedback</th></tr></thead>
            <tbody>{r.milestones.map((m) => <tr key={m.milestone_id}><td>{m.title}</td><td>{m.marks} / {m.max_marks}</td><td>{m.feedback}</td></tr>)}</tbody>
            <tfoot><tr><td><b>Total</b></td><td><b>{r.total_marks} / {r.max_marks}</b></td><td><b>{r.percentage}%</b></td></tr></tfoot>
          </table>
        </div>
      )}
    </>
  );
}
