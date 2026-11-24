"""Attendance Management API: FastAPI + a single JSON file as the database."""
import csv
import hashlib
import io
import json
import os
import random
import secrets
import threading
from contextlib import contextmanager
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Literal, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

STATUSES = ["Present", "Late", "Half Day", "Absent", "Leave"]
LATE_AFTER = "09:30"  # check-ins after this time are marked "Late"
DB_FILE = Path(__file__).parent / "data" / "db.json"

app = FastAPI(title="Attendance Management API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------------------------------
# JSON database
# --------------------------------------------------------------------------
_lock = threading.RLock()


def hash_password(password: str, salt: Optional[str] = None) -> str:
    salt = salt or secrets.token_hex(8)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    salt = stored.split("$")[0]
    return secrets.compare_digest(hash_password(password, salt), stored)


def _time(h: int, m: int) -> str:
    return f"{h:02d}:{m:02d}"


def seed_data() -> dict:
    """First run only: create demo users and two weeks of sample attendance."""
    users = [
        {"id": 1, "name": "Neha Rao", "username": "manager", "role": "manager",
         "password": hash_password("manager123")},
        {"id": 2, "name": "Aarav Shah", "username": "aarav", "role": "employee",
         "password": hash_password("employee123")},
        {"id": 3, "name": "Diya Nair", "username": "diya", "role": "employee",
         "password": hash_password("employee123")},
        {"id": 4, "name": "Kabir Singh", "username": "kabir", "role": "employee",
         "password": hash_password("employee123")},
    ]
    rng = random.Random(7)
    records = []
    for user in users:
        if user["role"] != "employee":
            continue
        for days_back in range(1, 15):
            day = date.today() - timedelta(days=days_back)
            if day.weekday() >= 5:  # skip weekends
                continue
            status = rng.choices(STATUSES, weights=[70, 12, 6, 6, 6])[0]
            check_in = check_out = None
            if status == "Present":
                check_in, check_out = _time(9, rng.randint(0, 25)), _time(17, rng.randint(30, 59))
            elif status == "Late":
                check_in, check_out = _time(9, rng.randint(40, 59)), _time(18, rng.randint(0, 20))
            elif status == "Half Day":
                check_in, check_out = _time(9, rng.randint(0, 20)), _time(13, rng.randint(0, 30))
            records.append({
                "employee_id": user["id"], "date": day.isoformat(), "status": status,
                "check_in": check_in, "check_out": check_out, "note": "",
                "updated_by": "System",
            })
    return {"users": users, "attendance": records, "sessions": {}}


def save_db(db: dict) -> None:
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = DB_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(db, indent=2), encoding="utf-8")
    os.replace(tmp, DB_FILE)  # atomic: never leaves a half-written file


def load_db() -> dict:
    with _lock:
        if not DB_FILE.exists():
            save_db(seed_data())
        return json.loads(DB_FILE.read_text(encoding="utf-8"))


@contextmanager
def transaction():
    """Load -> change -> save while holding a lock. Nothing is saved if an error is raised."""
    with _lock:
        db = load_db()
        yield db
        save_db(db)


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def public_user(user: dict) -> dict:
    return {k: user[k] for k in ("id", "name", "username", "role")}


def parse_date(value: str) -> str:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date().isoformat()
    except ValueError:
        raise HTTPException(400, f"'{value}' is not a valid date (use YYYY-MM-DD)")


def clean_time(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%H:%M").strftime("%H:%M")
    except ValueError:
        raise HTTPException(400, f"'{value}' is not a valid time (use HH:MM)")


def hours_between(check_in: Optional[str], check_out: Optional[str]) -> float:
    if not check_in or not check_out:
        return 0.0
    fmt = "%H:%M"
    seconds = (datetime.strptime(check_out, fmt) - datetime.strptime(check_in, fmt)).total_seconds()
    return round(max(seconds, 0) / 3600, 2)


def find_record(db: dict, employee_id: int, day: str) -> Optional[dict]:
    return next(
        (r for r in db["attendance"] if r["employee_id"] == employee_id and r["date"] == day),
        None,
    )


def summarise(records: list) -> dict:
    counts = {s: 0 for s in STATUSES}
    hours = 0.0
    for r in records:
        counts[r["status"]] += 1
        hours += hours_between(r.get("check_in"), r.get("check_out"))
    counted = len(records) - counts["Leave"]  # leave days don't hurt the rate
    worked = counts["Present"] + counts["Late"] + 0.5 * counts["Half Day"]
    rate = round(worked / counted * 100, 1) if counted else 0.0
    return {"counts": counts, "total_days": len(records),
            "hours": round(hours, 2), "attendance_rate": rate}


def build_report(db: dict, start: str, end: str, employee_id: Optional[int]) -> dict:
    start, end = parse_date(start), parse_date(end)
    if start > end:
        raise HTTPException(400, "Start date must be on or before the end date")
    employees = [u for u in db["users"] if u["role"] == "employee"]
    if employee_id is not None:
        employees = [u for u in employees if u["id"] == employee_id]
        if not employees:
            raise HTTPException(404, "Employee not found")

    summary, detail = [], []
    for emp in sorted(employees, key=lambda u: u["name"]):
        recs = [r for r in db["attendance"]
                if r["employee_id"] == emp["id"] and start <= r["date"] <= end]
        recs.sort(key=lambda r: r["date"])
        summary.append({"employee_id": emp["id"], "name": emp["name"], **summarise(recs)})
        for r in recs:
            detail.append({**r, "name": emp["name"],
                           "hours": hours_between(r.get("check_in"), r.get("check_out"))})
    detail.sort(key=lambda r: (r["date"], r["name"]))
    return {"start": start, "end": end, "summary": summary, "records": detail}


# --------------------------------------------------------------------------
# Auth
# --------------------------------------------------------------------------
def current_user(authorization: Optional[str] = Header(default=None)) -> dict:
    token = (authorization or "").removeprefix("Bearer ").strip()
    db = load_db()
    user_id = db["sessions"].get(token) if token else None
    user = next((u for u in db["users"] if u["id"] == user_id), None)
    if not user:
        raise HTTPException(401, "Your session has expired. Please log in again.")
    return user


def employee_only(user: dict = Depends(current_user)) -> dict:
    if user["role"] != "employee":
        raise HTTPException(403, "Only employees can do this")
    return user


def manager_only(user: dict = Depends(current_user)) -> dict:
    if user["role"] != "manager":
        raise HTTPException(403, "Only managers can do this")
    return user


class LoginIn(BaseModel):
    username: str
    password: str


class AttendanceIn(BaseModel):
    employee_id: int
    date: str
    status: Literal["Present", "Late", "Half Day", "Absent", "Leave"]
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    note: str = ""


@app.post("/api/login")
def login(body: LoginIn):
    with transaction() as db:
        user = next((u for u in db["users"] if u["username"] == body.username.strip().lower()), None)
        if not user or not verify_password(body.password, user["password"]):
            raise HTTPException(401, "Wrong username or password")
        token = secrets.token_hex(24)
        db["sessions"][token] = user["id"]
        return {"token": token, "user": public_user(user)}


@app.post("/api/logout")
def logout(authorization: Optional[str] = Header(default=None)):
    token = (authorization or "").removeprefix("Bearer ").strip()
    with transaction() as db:
        db["sessions"].pop(token, None)
    return {"ok": True}


@app.get("/api/me")
def me(user: dict = Depends(current_user)):
    return public_user(user)


# --------------------------------------------------------------------------
# Employee: mark own attendance
# --------------------------------------------------------------------------
@app.get("/api/attendance/today")
def my_today(user: dict = Depends(employee_only)):
    today = date.today().isoformat()
    return {"date": today, "record": find_record(load_db(), user["id"], today)}


@app.post("/api/attendance/check-in")
def check_in(user: dict = Depends(employee_only)):
    today, now = date.today().isoformat(), datetime.now().strftime("%H:%M")
    with transaction() as db:
        rec = find_record(db, user["id"], today)
        if rec and rec.get("check_in"):
            raise HTTPException(400, "You have already checked in today")
        if rec and rec["status"] == "Leave":
            raise HTTPException(400, "You are marked on leave today. Ask your manager to change it.")
        status = "Late" if now > LATE_AFTER else "Present"
        values = {"status": status, "check_in": now, "check_out": None, "updated_by": user["name"]}
        if rec:  # e.g. the manager had marked the day Absent earlier
            rec.update(values)
        else:
            rec = {"employee_id": user["id"], "date": today, "note": "", **values}
            db["attendance"].append(rec)
        return rec


@app.post("/api/attendance/check-out")
def check_out(user: dict = Depends(employee_only)):
    today, now = date.today().isoformat(), datetime.now().strftime("%H:%M")
    with transaction() as db:
        rec = find_record(db, user["id"], today)
        if not rec or not rec.get("check_in"):
            raise HTTPException(400, "Check in first")
        if rec.get("check_out"):
            raise HTTPException(400, "You have already checked out today")
        rec["check_out"] = now
        rec["updated_by"] = user["name"]
        return rec


@app.get("/api/attendance/me")
def my_history(month: Optional[str] = None, user: dict = Depends(employee_only)):
    month = month or date.today().strftime("%Y-%m")
    parse_date(month + "-01")
    records = [r for r in load_db()["attendance"]
               if r["employee_id"] == user["id"] and r["date"].startswith(month)]
    records.sort(key=lambda r: r["date"], reverse=True)
    return {"records": [{**r, "hours": hours_between(r.get("check_in"), r.get("check_out"))}
                        for r in records],
            "summary": summarise(records)}


# --------------------------------------------------------------------------
# Manager: view / change attendance, reports
# --------------------------------------------------------------------------
@app.get("/api/employees")
def list_employees(_: dict = Depends(manager_only)):
    users = [public_user(u) for u in load_db()["users"] if u["role"] == "employee"]
    return sorted(users, key=lambda u: u["name"])


@app.get("/api/attendance/daily")
def daily(day: str = Query(alias="date"), _: dict = Depends(manager_only)):
    day = parse_date(day)
    db = load_db()
    rows = []
    for emp in sorted((u for u in db["users"] if u["role"] == "employee"), key=lambda u: u["name"]):
        rec = find_record(db, emp["id"], day)
        rows.append({
            "employee_id": emp["id"], "name": emp["name"], "date": day,
            "status": rec["status"] if rec else "Not marked",
            "check_in": rec.get("check_in") if rec else None,
            "check_out": rec.get("check_out") if rec else None,
            "note": rec.get("note", "") if rec else "",
        })
    return rows


@app.put("/api/attendance")
def update_attendance(body: AttendanceIn, manager: dict = Depends(manager_only)):
    day = parse_date(body.date)
    if day > date.today().isoformat():
        raise HTTPException(400, "You can't mark attendance for a future date")
    check_in, check_out = clean_time(body.check_in), clean_time(body.check_out)
    if check_out and not check_in:
        raise HTTPException(400, "Add a check-in time before the check-out time")
    if check_in and check_out and check_out < check_in:
        raise HTTPException(400, "Check-out can't be earlier than check-in")

    with transaction() as db:
        if not any(u["id"] == body.employee_id and u["role"] == "employee" for u in db["users"]):
            raise HTTPException(404, "Employee not found")
        values = {"status": body.status, "check_in": check_in, "check_out": check_out,
                  "note": body.note.strip(), "updated_by": manager["name"]}
        rec = find_record(db, body.employee_id, day)
        if rec:
            rec.update(values)
        else:
            rec = {"employee_id": body.employee_id, "date": day, **values}
            db["attendance"].append(rec)
        return rec


@app.get("/api/reports")
def report(start: str, end: str, employee_id: Optional[int] = None,
           _: dict = Depends(manager_only)):
    return build_report(load_db(), start, end, employee_id)


@app.get("/api/reports/csv")
def report_csv(start: str, end: str, kind: Literal["summary", "detail"] = "detail",
               employee_id: Optional[int] = None, _: dict = Depends(manager_only)):
    data = build_report(load_db(), start, end, employee_id)
    buf = io.StringIO()
    writer = csv.writer(buf)
    if kind == "summary":
        writer.writerow(["Employee", *STATUSES, "Days recorded", "Hours", "Attendance %"])
        for s in data["summary"]:
            writer.writerow([s["name"], *(s["counts"][k] for k in STATUSES),
                             s["total_days"], s["hours"], s["attendance_rate"]])
    else:
        writer.writerow(["Date", "Employee", "Status", "Check in", "Check out", "Hours", "Note"])
        for r in data["records"]:
            writer.writerow([r["date"], r["name"], r["status"], r.get("check_in") or "",
                             r.get("check_out") or "", r["hours"], r.get("note", "")])
    filename = f"attendance-{kind}-{data['start']}-to-{data['end']}.csv"
    return Response(buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})
