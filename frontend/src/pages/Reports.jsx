import { useEffect, useState } from "react";
import { api } from "../api";
import { STATUSES, firstOfMonth, prettyDate, showHours, todayStr } from "../utils";
import StatusBadge from "../components/StatusBadge";

export default function Reports() {
  const [start, setStart] = useState(firstOfMonth());
  const [end, setEnd] = useState(todayStr());
  const [employeeId, setEmployeeId] = useState("");
  const [employees, setEmployees] = useState([]);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  const params = { start, end, ...(employeeId ? { employee_id: employeeId } : {}) };

  useEffect(() => {
    api.employees().then(setEmployees).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!start || !end) return;
    setError("");
    api
      .report({ start, end, ...(employeeId ? { employee_id: employeeId } : {}) })
      .then(setReport)
      .catch((e) => {
        setReport(null);
        setError(e.message);
      });
  }, [start, end, employeeId]);

  async function download(kind) {
    try {
      await api.downloadCsv(params, kind);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <>
      <section className="card">
        <div className="filters">
          <label>
            From
            <input type="date" value={start} max={end} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
          </label>
          <label>
            Employee
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">All employees</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </label>
          <div className="download">
            <button className="btn" onClick={() => download("summary")} disabled={!report}>
              Download summary CSV
            </button>
            <button className="btn" onClick={() => download("detail")} disabled={!report}>
              Download daily CSV
            </button>
          </div>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      {report && (
        <>
          <section className="card">
            <h2>Summary</h2>
            <p className="muted">
              Counts include only days that have a record. Leave days are left out of the attendance rate.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    {STATUSES.map((s) => (
                      <th key={s} className="num">{s}</th>
                    ))}
                    <th className="num">Hours</th>
                    <th className="num">Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {report.summary.map((s) => (
                    <tr key={s.employee_id}>
                      <td>{s.name}</td>
                      {STATUSES.map((k) => (
                        <td key={k} className="num">{s.counts[k]}</td>
                      ))}
                      <td className="num">{showHours(s.hours)}</td>
                      <td className="num"><strong>{s.attendance_rate}%</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <h2>Daily records</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Employee</th>
                    <th>Status</th>
                    <th>Check in</th>
                    <th>Check out</th>
                    <th>Hours</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {report.records.length === 0 && (
                    <tr>
                      <td colSpan="7" className="empty">No records in this date range.</td>
                    </tr>
                  )}
                  {report.records.map((r) => (
                    <tr key={`${r.employee_id}-${r.date}`}>
                      <td>{prettyDate(r.date)}</td>
                      <td>{r.name}</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td>{r.check_in || "—"}</td>
                      <td>{r.check_out || "—"}</td>
                      <td>{showHours(r.hours)}</td>
                      <td>{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
