import { useEffect, useState } from "react";

const BADGE = {
  formed: ["Group formed", ""], topic_submitted: ["Topic submitted", "warn"], topic_approved: ["Topic approved", "info"],
  guide_allocated: ["Guide allocated", "info"], completed: ["Completed", "ok"],
  pending: ["Pending", ""], submitted: ["Submitted", "warn"], reviewed: ["Reviewed", "ok"],
  approved: ["Approved", "ok"], rejected: ["Rejected", "bad"], changes_requested: ["Changes requested", "warn"],
};
export function Badge({ s, children }) {
  const [label, cls] = BADGE[s] || [s, ""];
  return <span className={`badge ${cls}`}>{children || label}</span>;
}

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—");
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

export function Msg({ error, ok }) {
  if (!error && !ok) return null;
  return <div className={`msg ${error ? "err" : "ok"}`}>{error || ok}</div>;
}

export function Stat({ n, l, alert }) {
  return <div className={`stat ${alert && n > 0 ? "alert" : ""}`}><div className="n">{n ?? "–"}</div><div className="l">{l}</div></div>;
}

export function Progress({ done, total }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return <div><div className="bar"><div style={{ width: pct + "%" }} /></div><div className="muted">{done}/{total} tasks reviewed</div></div>;
}

export const STAGES = [["formed", "Group"], ["topic_submitted", "Topic"], ["topic_approved", "Approved"], ["guide_allocated", "Guide"], ["completed", "Result"]];
export function Stages({ status }) {
  const idx = STAGES.findIndex(([k]) => k === status);
  return <div className="steps">{STAGES.map(([k, l], i) => <span key={k} className={i < idx ? "done" : i === idx ? "now" : ""}>{l}</span>)}</div>;
}

/** Loads data with an async fn; returns [data, {loading, error, reload}] */
export function useLoad(fn, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    fn().then((d) => live && (setData(d), setError(""))).catch((e) => live && setError(e.message)).finally(() => live && setLoading(false));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return [data, { loading, error, reload: () => setTick((t) => t + 1) }];
}
