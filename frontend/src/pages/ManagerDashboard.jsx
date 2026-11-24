import { useState } from "react";
import DailyAttendance from "./DailyAttendance";
import Reports from "./Reports";

export default function ManagerDashboard() {
  const [tab, setTab] = useState("daily");

  return (
    <>
      <nav className="tabs" aria-label="Manager sections">
        <button className={tab === "daily" ? "active" : ""} onClick={() => setTab("daily")}>
          Daily attendance
        </button>
        <button className={tab === "reports" ? "active" : ""} onClick={() => setTab("reports")}>
          Reports
        </button>
      </nav>
      {tab === "daily" ? <DailyAttendance /> : <Reports />}
    </>
  );
}
