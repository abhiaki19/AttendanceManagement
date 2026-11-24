import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { STATUSES, currentMonth, prettyDate, showHours } from "../utils";
import StatusBadge from "../components/StatusBadge";

export default function EmployeeDashboard() {
  const [today, setToday] = useState(null); // { date, record }
  const [month, setMonth] = useState(currentMonth());
  const [history, setHistory] = useState({ records: [], summary: null });
  const [now, setNow] = useState(new Date());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadAll = useCallback(async () => {
    try {
      const [t, h] = await Promise.all([api.today(), api.myHistory(month)]);
      setToday(t);
      setHistory(h);
    } catch (err) {
      setError(err.message);
    }
  }, [month]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function mark(action) {
    setBusy(true);
    setError("");
    try {
      await (action === "in" ? api.checkIn() : api.checkOut());
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const record = today?.record;
  const checkedIn = Boolean(record?.check_in);
  const checkedOut = Boolean(record?.check_out);

  let message = "You haven't checked in yet.";
  if (record && !checkedIn) message = `Your manager marked you ${record.status.toLowerCase()} today.`;
  else if (checkedOut) message = "You're done for today.";
  else if (checkedIn) message = "You're checked in.";

  return (
    <>
      <section className="card today">
        <div>
          <p className="muted">{now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
          <p className="clock">{now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>
          <p className="today-status">
            {record && <StatusBadge status={record.status} />} <span>{message}</span>
          </p>
          <p className="muted">
            Check in: <strong>{record?.check_in || "—"}</strong> &nbsp; Check out: <strong>{record?.check_out || "—"}</strong>
          </p>
        </div>
        <div className="today-actions">
          <button className="btn primary big" onClick={() => mark("in")} disabled={busy || checkedIn}>
            Check in
          </button>
          <button className="btn big" onClick={() => mark("out")} disabled={busy || !checkedIn || checkedOut}>
            Check out
          </button>
        </div>
        {error && <p className="error full" role="alert">{error}</p>}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>My attendance</h2>
          <label className="inline">
            Month
            <input type="month" value={month} max={currentMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} />
          </label>
        </div>

        {history.summary && (
          <div className="chips">
            {STATUSES.map((s) => (
              <span key={s} className="chip">
                <StatusBadge status={s} /> {history.summary.counts[s]}
              </span>
            ))}
            <span className="chip">Rate {history.summary.attendance_rate}%</span>
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
                <th>Check in</th>
                <th>Check out</th>
                <th>Hours</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {history.records.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty">No attendance recorded for this month.</td>
                </tr>
              )}
              {history.records.map((r) => (
                <tr key={r.date}>
                  <td>{prettyDate(r.date)}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{r.check_in || "—"}</td>
                  <td>{r.check_out || "—"}</td>
                  <td>{showHours(r.hours)}</td>
                  <td>{r.note || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
