import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import Layout from "./Layout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Notifications from "./pages/Notifications.jsx";
import MyGroup from "./pages/MyGroup.jsx";
import Topic from "./pages/Topic.jsx";
import Milestones from "./pages/Milestones.jsx";
import Result from "./pages/Result.jsx";
import Groups from "./pages/Groups.jsx";
import ReviewQueue from "./pages/ReviewQueue.jsx";
import Schedule from "./pages/Schedule.jsx";
import TopicApprovals from "./pages/TopicApprovals.jsx";
import Users from "./pages/Users.jsx";
import Activity from "./pages/Activity.jsx";

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="empty">Loading…</div>;
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }
  const r = user.role;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="notifications" element={<Notifications />} />
        {r === "student" && <>
          <Route path="group" element={<MyGroup />} />
          <Route path="topic" element={<Topic />} />
          <Route path="milestones" element={<Milestones />} />
          <Route path="result" element={<Result />} />
        </>}
        {r === "guide" && <>
          <Route path="groups" element={<Groups />} />
          <Route path="review" element={<ReviewQueue />} />
          <Route path="schedule" element={<Schedule />} />
        </>}
        {r === "coordinator" && <>
          <Route path="topics" element={<TopicApprovals />} />
          <Route path="groups" element={<Groups />} />
          <Route path="milestones" element={<Milestones />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="users" element={<Users />} />
          <Route path="activity" element={<Activity />} />
        </>}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
