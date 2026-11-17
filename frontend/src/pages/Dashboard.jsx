import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Badge, Msg, Progress, Stages, Stat, fmtDate, useLoad } from "../ui.jsx";

export default function Dashboard() {
  const { user } = useAuth();
  const [d, { loading, error }] = useLoad(() => api.get("/dashboard"));
  return (
    <>
      <h1>Welcome, {user.name.split(" ")[0]}</h1>
      <p className="muted">Here is where things stand.</p>
      <Msg error={error} />
      {loading && !d && <div className="empty">Loading…</div>}
      {d?.role === "student" && <StudentView d={d} />}
      {d?.role === "guide" && <GuideView d={d} />}
      {d?.role === "coordinator" && <CoordView d={d} />}
    </>
  );
}

function StudentView({ d }) {
  if (!d.group) return <div className="card"><h2>You are not in a group yet</h2><p>Create your project group to get started.</p><Link className="btn" to="/group">Create group</Link></div>;
  return (
    <>
      <div className="card">
        <div className="row"><h2 style={{ margin: 0 }}>{d.group.group_no}</h2><Badge s={d.group.status} /></div>
        <Stages status={d.group.status} />
      </div>
      <div className="grid">
        <Stat n={d.milestones.total} l="Tasks" />
        <Stat n={d.milestones.done} l="Reviewed" />
        <Stat n={d.milestones.overdue} l="Overdue" alert />
      </div>
      {d.milestones.total > 0 && <div className="card"><Progress done={d.milestones.done} total={d.milestones.total} /></div>}
      {d.next && <div className="card"><h2>Next task</h2><div className="row"><b>{d.next.title}</b><Badge s={d.next.status} /><span className="muted">due {fmtDate(d.next.due_date)}</span><Link to="/milestones">Open →</Link></div></div>}
    </>
  );
}

function GuideView({ d }) {
  return (
    <>
      <div className="grid">
        <Stat n={d.stats.groups} l="My groups" />
        <Stat n={d.stats.to_review} l="Awaiting review" alert />
        <Stat n={d.stats.reviewed} l="Reviewed" />
        <Stat n={d.stats.overdue} l="Overdue tasks" alert />
      </div>
      <div className="card"><h2>Group progress</h2>
        {d.groups.length === 0 ? <div className="empty">No groups allocated yet.</div> :
          <table><tbody>{d.groups.map((g) => <tr key={g.group_id}><td><b>{g.group_no}</b></td><td><Badge s={g.status} /></td><td style={{ width: "45%" }}><Progress done={g.done} total={g.total} /></td></tr>)}</tbody></table>}
      </div>
    </>
  );
}

function CoordView({ d }) {
  const t = d.totals;
  return (
    <>
      <div className="grid">
        <Stat n={t.students} l="Students" /><Stat n={t.guides} l="Guides" /><Stat n={t.groups} l="Groups" />
        <Stat n={t.ungrouped_students} l="Ungrouped students" />
        <Stat n={t.pending_topics} l="Topics to approve" alert />
        <Stat n={t.awaiting_guide} l="Awaiting guide" alert />
        <Stat n={t.overdue_milestones} l="Overdue tasks" alert />
        <Stat n={t.results_published} l="Results published" />
      </div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="card"><h2>Groups by stage</h2>
          <table><tbody>{d.byStatus.map((s) => <tr key={s.status}><td><Badge s={s.status} /></td><td>{s.count}</td></tr>)}</tbody></table>
        </div>
        <div className="card"><h2>Guide workload</h2>
          <table><tbody>{d.workload.map((w) => (
            <tr key={w.user_id}><td>{w.name}</td><td style={{ width: "40%" }}><div className="bar"><div style={{ width: (w.allocated / w.max_groups) * 100 + "%", background: w.allocated >= w.max_groups ? "var(--bad)" : undefined }} /></div></td><td>{w.allocated}/{w.max_groups}</td></tr>
          ))}</tbody></table>
        </div>
      </div>
    </>
  );
}
