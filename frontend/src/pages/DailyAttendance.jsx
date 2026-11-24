import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { prettyDate, todayStr } from "../utils";
import StatusBadge from "../components/StatusBadge";
import EditAttendanceModal from "../components/EditAttendanceModal";

export default function DailyAttendance() {
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setRows(await api.daily(date));
    } catch (err) {
      setError(err.message);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  function saved() {
    setEditing(null);
    load();
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>{prettyDate(date)}</h2>
        <label className="inline">
          Date
          <input type="date" value={date} max={todayStr()} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Status</th>
              <th>Check in</th>
              <th>Check out</th>
              <th>Note</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.employee_id}>
                <td>{r.name}</td>
                <td><StatusBadge status={r.status} /></td>
                <td>{r.check_in || "—"}</td>
                <td>{r.check_out || "—"}</td>
                <td>{r.note}</td>
                <td className="right">
                  <button className="btn small" onClick={() => setEditing(r)}>
                    Change
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && <EditAttendanceModal row={editing} onClose={() => setEditing(null)} onSaved={saved} />}
    </section>
  );
}
