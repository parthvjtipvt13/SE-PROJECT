import { useEffect, useState } from "react";
import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import { api } from "./api.js";

const NAV = {
  student: [["/", "Dashboard"], ["/group", "My Group"], ["/topic", "Project Topic"], ["/milestones", "Milestones"], ["/result", "Result"]],
  guide: [["/", "Dashboard"], ["/groups", "My Groups"], ["/review", "Review Queue"], ["/schedule", "Schedule"]],
  coordinator: [["/", "Dashboard"], ["/topics", "Topic Approvals"], ["/groups", "Groups"], ["/milestones", "Milestones"], ["/schedule", "Schedule"], ["/users", "Users"], ["/activity", "Activity Log"]],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const [unread, setUnread] = useState(0);
  const loc = useLocation();

  useEffect(() => {
    const load = () => api.get("/notifications").then((r) => setUnread(r.unread)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [loc.pathname]);

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">Projex<span>Hub</span></div>
        {NAV[user.role].map(([to, label]) => (
          <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>{label}</NavLink>
        ))}
        <div className="who">
          <div>{user.name}</div>
          <div className="muted" style={{ color: "#8fa3ba", textTransform: "capitalize" }}>{user.role}</div>
          <a href="#" onClick={(e) => { e.preventDefault(); logout(); }} style={{ padding: "6px 0", display: "block" }}>Sign out</a>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <div />
          <Link to="/notifications" className="bell">🔔 Notifications{unread > 0 && <b>{unread}</b>}</Link>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
