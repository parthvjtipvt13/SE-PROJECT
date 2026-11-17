import { useState } from "react";
import { api } from "../api.js";
import { Badge, Msg, Stages, useLoad } from "../ui.jsx";

export default function MyGroup() {
  const [g, { loading, error, reload }] = useLoad(() => api.get("/groups/mine"));
  const [rolls, setRolls] = useState("");
  const [err, setErr] = useState("");

  const create = async (e) => {
    e.preventDefault(); setErr("");
    try {
      await api.post("/groups", { member_roll_nos: rolls.split(/[\s,]+/).filter(Boolean) });
      reload();
    } catch (x) { setErr(x.message); }
  };

  if (loading && !g) return <div className="empty">Loading…</div>;
  return (
    <>
      <h1>My Group</h1>
      <Msg error={error} />
      {!g ? (
        <form className="card" onSubmit={create}>
          <h2>Create your project group</h2>
          <p className="muted">You will be added automatically. Enter the roll numbers of your teammates (they must already have registered). A group can have up to 5 members.</p>
          <Msg error={err} />
          <label>Teammate roll numbers (comma or space separated)</label>
          <input value={rolls} onChange={(e) => setRolls(e.target.value)} placeholder="241080038, 241080035, 241080036" />
          <div style={{ height: 14 }} /><button>Create group</button>
        </form>
      ) : (
        <>
          <div className="card">
            <div className="row"><h2 style={{ margin: 0 }}>{g.group_no}</h2><Badge s={g.status} /></div>
            <Stages status={g.status} />
            <p><b>Guide:</b> {g.guide_name || <span className="muted">Not allocated yet</span>}</p>
            <p><b>Topic:</b> {g.topic_title || <span className="muted">Not submitted yet</span>}</p>
          </div>
          <div className="card"><h2>Members</h2>
            <table><thead><tr><th>Roll no.</th><th>Name</th></tr></thead>
              <tbody>{g.members.map((m) => <tr key={m.user_id}><td>{m.roll_no}</td><td>{m.name}</td></tr>)}</tbody></table>
          </div>
        </>
      )}
    </>
  );
}
