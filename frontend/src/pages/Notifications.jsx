import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { Msg, fmtDateTime, useLoad } from "../ui.jsx";

export default function Notifications() {
  const nav = useNavigate();
  const [d, { error, reload }] = useLoad(() => api.get("/notifications"));
  const open = async (n) => {
    if (!n.is_read) await api.put(`/notifications/${n.notification_id}/read`);
    if (n.link) nav(n.link); else reload();
  };
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>Notifications</h1>
        {d?.unread > 0 && <button className="ghost sm" onClick={async () => { await api.put("/notifications/read-all"); reload(); }}>Mark all read</button>}
      </div>
      <Msg error={error} />
      <div className="card">
        {d?.items.length === 0 && <div className="empty">You're all caught up.</div>}
        {d?.items.map((n) => (
          <div key={n.notification_id} className={`notif ${n.is_read ? "" : "unread"}`} onClick={() => open(n)} style={{ cursor: "pointer" }}>
            <span>{!n.is_read && "● "}{n.message}</span><span className="muted">{fmtDateTime(n.created_at)}</span>
          </div>
        ))}
      </div>
    </>
  );
}
