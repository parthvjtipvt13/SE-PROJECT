import { useState } from "react";
import { useAuth } from "../auth.jsx";
import { Msg } from "../ui.jsx";

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ name: "", email: "", roll_no: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      if (mode === "login") await login(f.email, f.password);
      else await register(f);
    } catch (err) { setError(err.message); }
    setBusy(false);
  };
  const fill = (email, password) => setF({ ...f, email, password });

  return (
    <div className="auth">
      <form className="card" onSubmit={submit}>
        <h1>Projex<span>Hub</span></h1>
        <div className="muted">Centralized B.Tech Project Management System</div>
        <div style={{ height: 12 }} />
        <Msg error={error} />
        {mode === "register" && <>
          <label>Full name</label><input value={f.name} onChange={set("name")} required />
          <label>Roll number</label><input value={f.roll_no} onChange={set("roll_no")} required />
        </>}
        <label>Email</label><input type="email" value={f.email} onChange={set("email")} required />
        <label>Password</label><input type="password" value={f.password} onChange={set("password")} required minLength={mode === "register" ? 8 : 1} />
        <div style={{ height: 16 }} />
        <button disabled={busy} style={{ width: "100%" }}>{mode === "login" ? "Sign in" : "Create student account"}</button>
        <p className="muted" style={{ textAlign: "center" }}>
          {mode === "login" ? "New student? " : "Already registered? "}
          <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === "login" ? "register" : "login"); setError(""); }}>
            {mode === "login" ? "Register" : "Sign in"}
          </a>
        </p>
        {mode === "login" && (
          <div className="demo">
            <b>Demo accounts</b> (click to fill)<br />
            <a href="#" onClick={(e) => { e.preventDefault(); fill("rehan@projexhub.dev", "Student@123"); }}>Student</a> ·{" "}
            <a href="#" onClick={(e) => { e.preventDefault(); fill("guide1@projexhub.dev", "Guide@123"); }}>Guide</a> ·{" "}
            <a href="#" onClick={(e) => { e.preventDefault(); fill("coordinator@projexhub.dev", "Coord@123"); }}>Coordinator</a>
          </div>
        )}
      </form>
    </div>
  );
}
