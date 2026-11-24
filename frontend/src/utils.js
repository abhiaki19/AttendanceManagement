const pad = (n) => String(n).padStart(2, "0");

// Local-time date helpers (toISOString would shift the date for some timezones)
export const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => toDateStr(new Date());
export const currentMonth = () => todayStr().slice(0, 7);
export const firstOfMonth = () => `${currentMonth()}-01`;

export const STATUSES = ["Present", "Late", "Half Day", "Absent", "Leave"];

export function prettyDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export const showHours = (h) => (h ? `${h.toFixed(1)} h` : "—");
