import { useEffect, useState } from "react";
import { api } from "../api";
import { STATUSES, prettyDate } from "../utils";

// Lets a manager change one employee's attendance for one day.
export default function EditAttendanceModal({ row, onClose, onSaved }) {
  const [status, setStatus] = useState(row.status === "Not marked" ? "Present" : row.status);
  const [checkIn, setCheckIn] = useState(row.check_in || "");
  const [checkOut, setCheckOut] = useState(row.check_out || "");
  const [note, setNote] = useState(row.note || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.updateAttendance({
        employee_id: row.employee_id,
        date: row.date,
        status,
        check_in: checkIn || null,
        check_out: checkOut || null,
        note,
      });
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <form
        className="card modal"
        role="dialog"
        aria-modal="true"
        aria-label="Change attendance"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={save}
      >
        <h2>Change attendance</h2>
        <p className="muted">
          {row.name} · {prettyDate(row.date)}
        </p>

        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>

        <div className="row">
          <label>
            Check in
            <input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </label>
          <label>
            Check out
            <input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </label>
        </div>

        <label>
          Note
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for the change (optional)" />
        </label>

        {error && <p className="error" role="alert">{error}</p>}

        <div className="actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
