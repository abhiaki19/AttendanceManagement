# Attendance Management App

React (Vite) frontend, FastAPI backend, and a single JSON file as the database.

## Roles
- **Employee**: checks in and out each day, and sees their own monthly history.
- **Manager**: sees everyone's attendance for any date, changes any record, and generates reports (summary and daily records, with CSV download).

## Run it

**1. Backend** (http://127.0.0.1:8000)
```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```
The first start creates `backend/data/db.json` with demo users and two weeks of sample attendance. Delete that file to reset the data.

**2. Frontend** (http://localhost:5173), in a second terminal
```bash
cd frontend
npm install
npm run dev
```

## Demo logins
| Role | Username | Password |
|---|---|---|
| Manager | `manager` | `manager123` |
| Employee | `aarav`, `diya`, `kabir` | `employee123` |

## Project layout
```
backend/
  main.py            all API code (database helpers, auth, endpoints)
  data/db.json       created on first run
frontend/src/
  api.js             all calls to the backend
  App.jsx            login state, header, picks the dashboard by role
  pages/             Login, EmployeeDashboard, ManagerDashboard, DailyAttendance, Reports
  components/        StatusBadge, EditAttendanceModal
```

## API
Interactive docs: http://127.0.0.1:8000/docs

| Method | Path | Who | What |
|---|---|---|---|
| POST | `/api/login`, `/api/logout` | all | Start / end a session |
| GET | `/api/me` | all | Current user |
| GET | `/api/attendance/today` | employee | Today's record |
| POST | `/api/attendance/check-in` | employee | Mark check-in (after 09:30 = Late) |
| POST | `/api/attendance/check-out` | employee | Mark check-out |
| GET | `/api/attendance/me?month=YYYY-MM` | employee | Monthly history and counts |
| GET | `/api/employees` | manager | List employees |
| GET | `/api/attendance/daily?date=` | manager | Everyone's status for a day |
| PUT | `/api/attendance` | manager | Create or change a record |
| GET | `/api/reports?start=&end=&employee_id=` | manager | Summary and daily records |
| GET | `/api/reports/csv?...&kind=summary\|detail` | manager | CSV download |

## Good to know
- The late cut-off is `LATE_AFTER` at the top of `main.py`.
- Reports count only days that have a record. If a day should count as absent, the manager sets it on the Daily attendance tab.
- A JSON file suits a small team and demos. For many users or heavy traffic, move to SQLite or PostgreSQL.
- For production, also move session tokens and passwords into a proper auth setup (for example JWT with HTTPS) and restrict CORS.
