import { useEffect, useState } from "react";
import { api, getToken, setToken } from "./api";
import Login from "./pages/Login";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import ManagerDashboard from "./pages/ManagerDashboard";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  // Restore the session if a token is already saved
  useEffect(() => {
    if (!getToken()) return;
    api
      .me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  // api.js fires this when the server says the session is no longer valid
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener("auth-expired", onExpired);
    return () => window.removeEventListener("auth-expired", onExpired);
  }, []);

  async function logout() {
    try {
      await api.logout();
    } catch {
      /* log out locally even if the server call fails */
    }
    setToken(null);
    setUser(null);
  }

  if (loading) return <p className="page-note">Loading…</p>;
  if (!user) return <Login onLogin={setUser} />;

  return (
    <div className="app">
      <header className="topbar">
        <h1>Attendance</h1>
        <div className="who">
          <span>{user.name}</span>
          <span className="role-tag">{user.role}</span>
          <button className="btn ghost" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <main className="content">
        {user.role === "manager" ? <ManagerDashboard /> : <EmployeeDashboard />}
      </main>
    </div>
  );
}
