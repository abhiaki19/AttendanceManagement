const TOKEN_KEY = "attendance_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) =>
  token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY);

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    if (res.status === 401 && path !== "/login") {
      setToken(null);
      window.dispatchEvent(new Event("auth-expired"));
    }
    let message = "Something went wrong. Please try again.";
    try {
      const body = await res.json();
      if (typeof body.detail === "string") message = body.detail;
      else if (Array.isArray(body.detail)) message = body.detail.map((d) => d.msg).join(", ");
    } catch {
      /* keep default message */
    }
    throw new Error(message);
  }
  return res;
}

const json = async (path, options) => (await request(path, options)).json();
const query = (params) => new URLSearchParams(params).toString();
const post = (path, body) => json(path, { method: "POST", body: JSON.stringify(body) });

export const api = {
  login: (username, password) => post("/login", { username, password }),
  logout: () => post("/logout", {}),
  me: () => json("/me"),

  // Employee
  today: () => json("/attendance/today"),
  checkIn: () => post("/attendance/check-in", {}),
  checkOut: () => post("/attendance/check-out", {}),
  myHistory: (month) => json(`/attendance/me?${query({ month })}`),

  // Manager
  employees: () => json("/employees"),
  daily: (date) => json(`/attendance/daily?${query({ date })}`),
  updateAttendance: (body) => json("/attendance", { method: "PUT", body: JSON.stringify(body) }),
  report: (params) => json(`/reports?${query(params)}`),

  async downloadCsv(params, kind) {
    const res = await request(`/reports/csv?${query({ ...params, kind })}`);
    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `attendance-${kind}-${params.start}-to-${params.end}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  },
};
