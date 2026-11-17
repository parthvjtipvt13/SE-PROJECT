import { api } from "../api.js";
import { Msg, fmtDateTime, useLoad } from "../ui.jsx";

export default function Activity() {
  const [rows, { error }] = useLoad(() => api.get("/users/activity/log"));
  return (
    <>
      <h1>Activity Log</h1><Msg error={error} />
      <div className="card"><table>
        <thead><tr><th>When</th><th>User</th><th>Action</th><th>Detail</th></tr></thead>
        <tbody>{rows?.map((r) => <tr key={r.log_id}><td>{fmtDateTime(r.created_at)}</td><td>{r.user_name || "—"}</td><td><span className="badge">{r.action}</span></td><td>{r.detail}</td></tr>)}</tbody></table></div>
    </>
  );
}
