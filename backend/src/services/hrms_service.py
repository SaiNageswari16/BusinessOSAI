import uuid
from datetime import datetime, date
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from src.models.hrms import (
    Employee, Department, Designation, Team, EmployeeDocument,
    EmployeeAttendance, LeaveRequest, PayrollRecord,
    RecruitmentJob, JobApplicant, EmployeePerformance, ExitRequest
)
from src.models.trainer import TrainerProfile
from src.models.user import User

class HrmsService:
    # -------------------------------------------------------------
    # 1. EMPLOYEE MANAGEMENT & TRAINERS MAPPING METHODS
    # -------------------------------------------------------------
    @staticmethod
    def sync_trainers_to_employees(db: Session) -> None:
        """
        Synchronizes all trainers and staff from TrainerProfile into HRMS Employee records.
        Removes any obsolete or mock employee records that do not belong to actual trainers/staff.
        """
        trainers = db.query(TrainerProfile).all()
        trainer_emails = {t.email.strip().lower() for t in trainers if t.email}

        # 1. Purge obsolete/mock employees not present in TrainerProfile
        all_employees = db.query(Employee).all()
        for emp in all_employees:
            if not emp.email or emp.email.strip().lower() not in trainer_emails:
                db.query(EmployeeAttendance).filter(EmployeeAttendance.employee_id == emp.id).delete()
                db.query(LeaveRequest).filter(LeaveRequest.employee_id == emp.id).delete()
                db.query(PayrollRecord).filter(PayrollRecord.employee_id == emp.id).delete()
                db.query(EmployeeDocument).filter(EmployeeDocument.employee_id == emp.id).delete()
                db.query(EmployeePerformance).filter(EmployeePerformance.employee_id == emp.id).delete()
                db.query(ExitRequest).filter(ExitRequest.employee_id == emp.id).delete()
                db.delete(emp)
        db.flush()

        # 2. Upsert each TrainerProfile into Employee
        for idx, t in enumerate(trainers, start=1):
            full_name = (t.full_name or "").strip()
            parts = full_name.split(" ", 1)
            first_name = parts[0] if parts else "Staff"
            last_name = parts[1] if len(parts) > 1 else ""

            role = (t.role or "TRAINER").upper()
            if role == "GYM_OWNER":
                dept = "Executive Management"
                desg = t.specialization or "Gym Owner / Director"
            elif role == "MANAGER":
                dept = "Operations & Management"
                desg = t.specialization or "Gym Operations Manager"
            elif role == "STAFF":
                dept = "Front Desk & Customer Support"
                desg = t.specialization or "Front Desk Executive"
            else:
                dept = "Fitness & Training"
                desg = t.specialization or "Fitness Coach & Trainer"

            status = "Active" if t.is_active else "Inactive"
            salary = float(t.base_monthly_salary or 0.0)
            joined = t.created_at.date() if t.created_at else date.today()
            code = f"{idx:04d}"

            existing_emp = db.query(Employee).filter(
                (Employee.email.ilike(t.email)) | (Employee.id == f"emp_{t.id}")
            ).first()

            if existing_emp:
                existing_emp.first_name = first_name
                existing_emp.last_name = last_name
                existing_emp.email = t.email
                existing_emp.phone = t.phone or existing_emp.phone or ""
                existing_emp.designation = desg
                existing_emp.department = dept
                existing_emp.status = status
                existing_emp.salary = salary
                existing_emp.gym_branch = t.primary_gym_location or existing_emp.gym_branch or ""
                if not existing_emp.code:
                    existing_emp.code = code
            else:
                new_emp = Employee(
                    id=f"emp_{t.id}",
                    code=code,
                    first_name=first_name,
                    last_name=last_name,
                    email=t.email,
                    phone=t.phone or "",
                    designation=desg,
                    department=dept,
                    reporting_manager="Director / Owner",
                    joined_date=joined,
                    employment_type="Full-Time",
                    status=status,
                    salary=salary,
                    avatar="",
                    gym_branch=t.primary_gym_location or "Main Branch",
                    skills=[t.specialization] if t.specialization else []
                )
                db.add(new_emp)

        db.commit()

    @staticmethod
    def get_employees(db: Session, department: Optional[str] = None, status: Optional[str] = None, search: Optional[str] = None) -> List[Dict[str, Any]]:
        # Always sync with trainer profiles first
        try:
            HrmsService.sync_trainers_to_employees(db)
        except Exception:
            db.rollback()

        query = db.query(Employee)
        if department and department != "All Departments":
            query = query.filter(Employee.department == department)
        if status and status != "All Statuses":
            query = query.filter(Employee.status.ilike(status))
        if search:
            s = f"%{search.strip()}%"
            query = query.filter(
                (Employee.first_name.ilike(s)) |
                (Employee.last_name.ilike(s)) |
                (Employee.email.ilike(s)) |
                (Employee.code.ilike(s)) |
                (Employee.designation.ilike(s))
            )

        employees = query.order_by(Employee.code.asc(), Employee.created_at.desc()).all()
        result = []
        for e in employees:
            full_name = f"{e.first_name} {e.last_name or ''}".strip()
            parts = full_name.split()
            initials = "".join([p[0].upper() for p in parts[:2]]) if parts else "EM"
            result.append({
                "id": e.id,
                "code": e.code,
                "first_name": e.first_name,
                "last_name": e.last_name or "",
                "full_name": full_name,
                "initials": initials,
                "email": e.email,
                "phone": e.phone or "",
                "designation": e.designation,
                "department": e.department,
                "reporting_manager": e.reporting_manager or "",
                "joined_date": e.joined_date.strftime("%d/%m/%Y") if e.joined_date else "",
                "employment_type": e.employment_type or "Full-Time",
                "status": e.status or "Active",
                "salary": float(e.salary or 0.0),
                "avatar": e.avatar or "",
                "skills": e.skills or [],
                "gym_branch": e.gym_branch or "",
                "emergency_contact": e.emergency_contact or "",
                "created_at": e.created_at.isoformat() if e.created_at else None
            })
        return result

    @staticmethod
    def create_employee(db: Session, payload: Dict[str, Any]) -> Dict[str, Any]:
        first_name = str(payload.get("first_name") or "").strip()
        last_name = str(payload.get("last_name") or "").strip()
        full_name = f"{first_name} {last_name}".strip() or "New Staff"
        email = str(payload.get("email") or "").strip()
        phone = str(payload.get("phone") or "").strip()
        designation = str(payload.get("designation") or "Fitness Trainer").strip()
        department = str(payload.get("department") or "Fitness & Training").strip()
        salary = float(payload.get("salary") or 0.0)
        gym_branch = str(payload.get("gym_branch") or "").strip()

        # Map department/designation to TrainerProfile role
        role = "TRAINER"
        if "Management" in department or "Director" in designation or "Owner" in designation:
            role = "MANAGER" if "Operations" in department else "GYM_OWNER"
        elif "Front Desk" in department or "Support" in department:
            role = "STAFF"

        # Also register in TrainerProfile so both remain in sync
        from src.services.payroll_service import PayrollService
        PayrollService.register_trainer(db, {
            "full_name": full_name,
            "email": email,
            "phone": phone,
            "role": role,
            "specialization": designation,
            "base_monthly_salary": salary,
            "primary_gym_location": gym_branch
        })

        HrmsService.sync_trainers_to_employees(db)
        emp = db.query(Employee).filter(Employee.email == email).first()
        return {"message": "Employee created and synced successfully", "id": emp.id if emp else "", "code": emp.code if emp else ""}

    @staticmethod
    def update_employee(db: Session, emp_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        emp = db.query(Employee).filter(Employee.id == emp_id).first()
        if not emp:
            raise ValueError("Employee not found")

        for key, val in payload.items():
            if hasattr(emp, key) and key not in ["id", "created_at"]:
                if key == "joined_date" and isinstance(val, str) and val.strip():
                    try:
                        val = datetime.strptime(val.strip(), "%Y-%m-%d").date()
                    except Exception:
                        continue
                elif key == "salary" and val is not None:
                    try:
                        val = float(val)
                    except Exception:
                        val = 0.0
                setattr(emp, key, val)

        # Sync back to TrainerProfile if exists
        trainer_id = emp_id.replace("emp_", "")
        trainer = db.query(TrainerProfile).filter(
            (TrainerProfile.id == trainer_id) | (TrainerProfile.email == emp.email)
        ).first()
        if trainer:
            full_name = f"{emp.first_name} {emp.last_name or ''}".strip()
            trainer.full_name = full_name
            trainer.email = emp.email
            trainer.phone = emp.phone
            trainer.specialization = emp.designation
            trainer.base_monthly_salary = emp.salary
            trainer.is_active = (emp.status.lower() == "active")

        db.commit()
        return {"message": "Employee updated successfully"}

    @staticmethod
    def delete_employee(db: Session, emp_id: str) -> bool:
        emp = db.query(Employee).filter(Employee.id == emp_id).first()
        if not emp:
            return False

        trainer_id = emp_id.replace("emp_", "")
        trainer = db.query(TrainerProfile).filter(
            (TrainerProfile.id == trainer_id) | (TrainerProfile.email == emp.email)
        ).first()
        if trainer:
            db.delete(trainer)

        db.delete(emp)
        db.commit()
        return True


    # -------------------------------------------------------------
    # 2. DEPARTMENTS, DESIGNATIONS, TEAMS, DOCUMENTS
    # -------------------------------------------------------------
    @staticmethod
    def get_departments(db: Session) -> List[Dict[str, Any]]:
        depts = db.query(Department).order_by(Department.name.asc()).all()
        result = []
        for d in depts:
            count = db.query(Employee).filter(Employee.department == d.name).count()
            result.append({
                "id": d.id,
                "name": d.name,
                "code": d.code,
                "description": d.description or "",
                "head_name": d.head_name or "",
                "is_active": d.is_active,
                "employee_count": count
            })
        return result

    @staticmethod
    def create_department(db: Session, payload: Dict[str, Any]) -> Dict[str, Any]:
        dept = Department(
            id=f"dept_{uuid.uuid4().hex[:8]}",
            name=str(payload.get("name") or "").strip(),
            code=str(payload.get("code") or "").strip(),
            description=str(payload.get("description") or "").strip(),
            head_name=str(payload.get("head_name") or "").strip(),
            is_active=bool(payload.get("is_active", True))
        )
        db.add(dept)
        db.commit()
        return {"message": "Department created successfully", "id": dept.id}

    @staticmethod
    def get_designations(db: Session) -> List[Dict[str, Any]]:
        desgs = db.query(Designation).order_by(Designation.title.asc()).all()
        result = []
        for d in desgs:
            emp_count = db.query(Employee).filter(Employee.designation == d.title).count()
            result.append({
                "id": d.id,
                "title": d.title,
                "department": d.department,
                "level": d.level or "",
                "description": d.description or "",
                "employee_count": emp_count
            })
        return result

    @staticmethod
    def create_designation(db: Session, payload: Dict[str, Any]) -> Dict[str, Any]:
        desg = Designation(
            id=f"desg_{uuid.uuid4().hex[:8]}",
            title=str(payload.get("title") or "").strip(),
            department=str(payload.get("department") or "").strip(),
            level=str(payload.get("level") or "").strip(),
            description=str(payload.get("description") or "").strip()
        )
        db.add(desg)
        db.commit()
        return {"message": "Designation created successfully", "id": desg.id}

    @staticmethod
    def get_teams(db: Session) -> List[Dict[str, Any]]:
        teams = db.query(Team).order_by(Team.name.asc()).all()
        return [
            {
                "id": t.id,
                "name": t.name,
                "department": t.department,
                "lead_name": t.lead_name or "",
                "description": t.description or ""
            } for t in teams
        ]

    @staticmethod
    def create_team(db: Session, payload: Dict[str, Any]) -> Dict[str, Any]:
        team = Team(
            id=f"team_{uuid.uuid4().hex[:8]}",
            name=str(payload.get("name") or "").strip(),
            department=str(payload.get("department") or "").strip(),
            lead_name=str(payload.get("lead_name") or "").strip(),
            description=str(payload.get("description") or "").strip()
        )
        db.add(team)
        db.commit()
        return {"message": "Team created successfully", "id": team.id}

    @staticmethod
    def get_documents(db: Session, employee_id: Optional[str] = None) -> List[Dict[str, Any]]:
        query = db.query(EmployeeDocument)
        if employee_id:
            query = query.filter(EmployeeDocument.employee_id == employee_id)
        docs = query.order_by(EmployeeDocument.uploaded_at.desc()).all()
        result = []
        for d in docs:
            emp = db.query(Employee).filter(Employee.id == d.employee_id).first()
            emp_name = f"{emp.first_name} {emp.last_name or ''}".strip() if emp else ""
            result.append({
                "id": d.id,
                "employee_id": d.employee_id,
                "employee_name": emp_name,
                "title": d.title,
                "doc_type": d.doc_type or "",
                "file_size": d.file_size or "",
                "status": d.status or "Pending",
                "uploaded_at": d.uploaded_at.strftime("%d/%m/%Y") if d.uploaded_at else ""
            })
        return result

    # -------------------------------------------------------------
    # 3. ATTENDANCE METHODS
    # -------------------------------------------------------------
    @staticmethod
    def get_attendance_logs(db: Session, selected_date: Optional[str] = None) -> List[Dict[str, Any]]:
        target_date = date.today()
        if selected_date:
            try:
                target_date = datetime.strptime(selected_date, "%Y-%m-%d").date()
            except Exception:
                pass

        logs = db.query(EmployeeAttendance).filter(EmployeeAttendance.date == target_date).order_by(EmployeeAttendance.created_at.desc()).all()
        result = []
        for l in logs:
            emp = db.query(Employee).filter(Employee.id == l.employee_id).first()
            if not emp:
                continue
            full_name = f"{emp.first_name} {emp.last_name or ''}".strip()
            parts = full_name.split()
            initials = "".join([p[0].upper() for p in parts[:2]]) if parts else "EM"
            result.append({
                "id": l.id,
                "employee_id": l.employee_id,
                "employee_code": emp.code,
                "employee_name": full_name,
                "initials": initials,
                "designation": emp.designation,
                "department": emp.department,
                "date": l.date.strftime("%d/%m/%Y") if l.date else "",
                "check_in": l.check_in or "--:--",
                "check_out": l.check_out or "--:--",
                "status": l.status,
                "work_hours": float(l.work_hours or 0.0),
                "notes": l.notes or ""
            })
        return result

    @staticmethod
    def record_punch(db: Session, employee_id: str, action: str, note: Optional[str] = None) -> Dict[str, Any]:
        today = date.today()
        att = db.query(EmployeeAttendance).filter(
            EmployeeAttendance.employee_id == employee_id,
            EmployeeAttendance.date == today
        ).first()

        now_str = datetime.now().strftime("%I:%M %p")
        if not att:
            att = EmployeeAttendance(
                id=f"att_{uuid.uuid4().hex[:8]}",
                employee_id=employee_id,
                date=today,
                check_in=now_str if action == "CHECK_IN" else None,
                check_out=now_str if action == "CHECK_OUT" else None,
                status="Present",
                work_hours=0.0,
                notes=note or ""
            )
            db.add(att)
        else:
            if action == "CHECK_IN":
                att.check_in = now_str
                att.status = "Present"
            elif action == "CHECK_OUT":
                att.check_out = now_str
            if note:
                att.notes = note

        db.commit()
        return {"message": f"Punch {action} recorded at {now_str}"}

    # -------------------------------------------------------------
    # 4. LEAVE MANAGEMENT METHODS
    # -------------------------------------------------------------
    @staticmethod
    def get_leaves(db: Session) -> List[Dict[str, Any]]:
        leaves = db.query(LeaveRequest).order_by(LeaveRequest.created_at.desc()).all()
        result = []
        for l in leaves:
            emp = db.query(Employee).filter(Employee.id == l.employee_id).first()
            emp_name = f"{emp.first_name} {emp.last_name or ''}".strip() if emp else ""
            emp_code = emp.code if emp else ""
            result.append({
                "id": l.id,
                "employee_id": l.employee_id,
                "employee_name": emp_name,
                "employee_code": emp_code,
                "department": emp.department if emp else "",
                "leave_type": l.leave_type,
                "start_date": l.start_date.strftime("%d/%m/%Y") if l.start_date else "",
                "end_date": l.end_date.strftime("%d/%m/%Y") if l.end_date else "",
                "days": l.days,
                "reason": l.reason or "",
                "status": l.status,
                "approved_by": l.approved_by or "Pending Review",
                "applied_on": l.created_at.strftime("%d/%m/%Y") if l.created_at else ""
            })
        return result

    @staticmethod
    def apply_leave(db: Session, payload: Dict[str, Any]) -> Dict[str, Any]:
        start = datetime.strptime(payload["start_date"], "%Y-%m-%d").date()
        end = datetime.strptime(payload["end_date"], "%Y-%m-%d").date()
        days = max(1, (end - start).days + 1)
        leave = LeaveRequest(
            id=f"leave_{uuid.uuid4().hex[:8]}",
            employee_id=payload["employee_id"],
            leave_type=str(payload.get("leave_type") or "Casual Leave").strip(),
            start_date=start,
            end_date=end,
            days=days,
            reason=str(payload.get("reason") or "").strip(),
            status="Pending"
        )
        db.add(leave)
        db.commit()
        return {"message": "Leave application submitted successfully", "id": leave.id}

    @staticmethod
    def update_leave_status(db: Session, leave_id: str, status: str, reviewer: Optional[str] = None) -> Dict[str, Any]:
        leave = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
        if not leave:
            raise ValueError("Leave request not found")
        leave.status = status
        if reviewer:
            leave.approved_by = reviewer
        db.commit()
        return {"message": f"Leave request status updated to {status}"}

    # -------------------------------------------------------------
    # 5. PAYROLL METHODS
    # -------------------------------------------------------------
    @staticmethod
    def get_payroll_records(db: Session, month: Optional[str] = None, year: Optional[int] = None) -> List[Dict[str, Any]]:
        query = db.query(PayrollRecord)
        if month:
            query = query.filter(PayrollRecord.month == month)
        if year:
            query = query.filter(PayrollRecord.year == year)
        records = query.order_by(PayrollRecord.created_at.desc()).all()
        result = []
        for p in records:
            emp = db.query(Employee).filter(Employee.id == p.employee_id).first()
            if not emp:
                continue
            full_name = f"{emp.first_name} {emp.last_name or ''}".strip()
            parts = full_name.split()
            initials = "".join([part[0].upper() for part in parts[:2]]) if parts else "EM"
            result.append({
                "id": p.id,
                "employee_id": p.employee_id,
                "employee_code": emp.code,
                "employee_name": full_name,
                "initials": initials,
                "designation": emp.designation,
                "department": emp.department,
                "month": p.month,
                "year": p.year,
                "base_salary": float(p.base_salary or 0.0),
                "allowances": float(p.allowances or 0.0),
                "deductions": float(p.deductions or 0.0),
                "net_salary": float(p.net_salary or 0.0),
                "status": p.status,
                "payment_method": p.payment_method or "",
                "payment_date": p.payment_date.strftime("%d/%m/%Y") if p.payment_date else "Pending"
            })
        return result

    @staticmethod
    def process_payroll_payout(db: Session, payroll_id: str, status: str = "Paid") -> Dict[str, Any]:
        pay = db.query(PayrollRecord).filter(PayrollRecord.id == payroll_id).first()
        if not pay:
            raise ValueError("Payroll record not found")
        pay.status = status
        if status == "Paid":
            pay.payment_date = date.today()
        db.commit()
        return {"message": f"Payroll payout status updated to {status}"}

    # -------------------------------------------------------------
    # 6. RECRUITMENT METHODS
    # -------------------------------------------------------------
    @staticmethod
    def get_recruitment_overview(db: Session) -> Dict[str, Any]:
        jobs = db.query(RecruitmentJob).order_by(RecruitmentJob.posted_date.desc()).all()
        applicants = db.query(JobApplicant).order_by(JobApplicant.applied_date.desc()).all()

        job_list = []
        for j in jobs:
            app_count = db.query(JobApplicant).filter(JobApplicant.job_id == j.id).count()
            job_list.append({
                "id": j.id,
                "title": j.title,
                "department": j.department,
                "openings": j.openings,
                "job_type": j.job_type or "",
                "experience": j.experience or "",
                "salary_range": j.salary_range or "",
                "status": j.status,
                "posted_date": j.posted_date.strftime("%d/%m/%Y") if j.posted_date else "",
                "applicant_count": app_count
            })

        app_list = []
        for a in applicants:
            job = db.query(RecruitmentJob).filter(RecruitmentJob.id == a.job_id).first() if a.job_id else None
            app_list.append({
                "id": a.id,
                "job_id": a.job_id,
                "job_title": job.title if job else "",
                "department": job.department if job else "",
                "name": a.name,
                "email": a.email,
                "phone": a.phone or "",
                "stage": a.stage,
                "experience_years": float(a.experience_years or 0.0),
                "rating": float(a.rating or 0.0),
                "applied_date": a.applied_date.strftime("%d/%m/%Y") if a.applied_date else ""
            })

        return {
            "jobs": job_list,
            "applicants": app_list,
            "total_openings": sum(j.openings for j in jobs if j.status == "Open"),
            "total_applicants": len(applicants)
        }

    @staticmethod
    def update_applicant_stage(db: Session, applicant_id: str, new_stage: str) -> Dict[str, Any]:
        app = db.query(JobApplicant).filter(JobApplicant.id == applicant_id).first()
        if not app:
            raise ValueError("Applicant not found")
        app.stage = new_stage
        db.commit()
        return {"message": f"Candidate stage updated to {new_stage}"}

    # -------------------------------------------------------------
    # 7. PERFORMANCE METHODS
    # -------------------------------------------------------------
    @staticmethod
    def get_performance_reviews(db: Session) -> List[Dict[str, Any]]:
        perfs = db.query(EmployeePerformance).order_by(EmployeePerformance.created_at.desc()).all()
        result = []
        for p in perfs:
            emp = db.query(Employee).filter(Employee.id == p.employee_id).first()
            if not emp:
                continue
            full_name = f"{emp.first_name} {emp.last_name or ''}".strip()
            parts = full_name.split()
            initials = "".join([part[0].upper() for part in parts[:2]]) if parts else "EM"
            result.append({
                "id": p.id,
                "employee_id": p.employee_id,
                "employee_code": emp.code,
                "employee_name": full_name,
                "initials": initials,
                "designation": emp.designation,
                "department": emp.department,
                "review_period": p.review_period,
                "score": float(p.score or 0.0),
                "kpi_ratings": p.kpi_ratings or [],
                "feedback": p.feedback or "",
                "reviewer": p.reviewer or "",
                "status": p.status
            })
        return result

    # -------------------------------------------------------------
    # 8. EXIT MANAGEMENT METHODS
    # -------------------------------------------------------------
    @staticmethod
    def get_exit_requests(db: Session) -> List[Dict[str, Any]]:
        exits = db.query(ExitRequest).order_by(ExitRequest.created_at.desc()).all()
        result = []
        for x in exits:
            emp = db.query(Employee).filter(Employee.id == x.employee_id).first()
            if not emp:
                continue
            full_name = f"{emp.first_name} {emp.last_name or ''}".strip()
            parts = full_name.split()
            initials = "".join([part[0].upper() for part in parts[:2]]) if parts else "EM"
            result.append({
                "id": x.id,
                "employee_id": x.employee_id,
                "employee_code": emp.code,
                "employee_name": full_name,
                "initials": initials,
                "designation": emp.designation,
                "department": emp.department,
                "resignation_date": x.resignation_date.strftime("%d/%m/%Y") if x.resignation_date else "",
                "last_working_day": x.last_working_day.strftime("%d/%m/%Y") if x.last_working_day else "",
                "reason": x.reason or "",
                "handover_status": x.handover_status,
                "settlement_status": x.settlement_status,
                "status": x.status
            })
        return result

    @staticmethod
    def update_exit_status(db: Session, exit_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        req = db.query(ExitRequest).filter(ExitRequest.id == exit_id).first()
        if not req:
            raise ValueError("Exit request not found")
        if payload.get("status"):
            req.status = payload["status"]
        if payload.get("handover_status"):
            req.handover_status = payload["handover_status"]
        if payload.get("settlement_status"):
            req.settlement_status = payload["settlement_status"]
        db.commit()
        return {"message": "Exit status updated successfully"}
