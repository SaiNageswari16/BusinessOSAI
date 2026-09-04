from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from src.database import get_db
from src.services.hrms_service import HrmsService

router = APIRouter(prefix="/hrms", tags=["HRMS"])

# -------------------------------------------------------------
# 1. EMPLOYEE MANAGEMENT ENDPOINTS
# -------------------------------------------------------------
@router.get("/employees")
def get_employees(
    department: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    return HrmsService.get_employees(db, department=department, status=status, search=search)

@router.post("/employees")
def create_employee(payload: dict, db: Session = Depends(get_db)):
    return HrmsService.create_employee(db, payload)

@router.put("/employees/{emp_id}")
def update_employee(emp_id: str, payload: dict, db: Session = Depends(get_db)):
    try:
        return HrmsService.update_employee(db, emp_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/employees/{emp_id}")
def delete_employee(emp_id: str, db: Session = Depends(get_db)):
    success = HrmsService.delete_employee(db, emp_id)
    if not success:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"message": "Employee deleted successfully"}

# -------------------------------------------------------------
# 2. DEPARTMENTS, DESIGNATIONS, TEAMS, DOCUMENTS
# -------------------------------------------------------------
@router.get("/departments")
def get_departments(db: Session = Depends(get_db)):
    return HrmsService.get_departments(db)

@router.get("/designations")
def get_designations(db: Session = Depends(get_db)):
    return HrmsService.get_designations(db)

@router.get("/teams")
def get_teams(db: Session = Depends(get_db)):
    return HrmsService.get_teams(db)

@router.get("/documents")
def get_documents(employee_id: Optional[str] = None, db: Session = Depends(get_db)):
    return HrmsService.get_documents(db, employee_id)

# -------------------------------------------------------------
# 3. ATTENDANCE ENDPOINTS
# -------------------------------------------------------------
@router.get("/attendance")
def get_attendance(date: Optional[str] = None, db: Session = Depends(get_db)):
    return HrmsService.get_attendance_logs(db, selected_date=date)

@router.post("/attendance/punch")
def record_punch(payload: dict, db: Session = Depends(get_db)):
    emp_id = payload.get("employee_id")
    action = payload.get("action", "CHECK_IN")
    note = payload.get("note")
    if not emp_id:
        raise HTTPException(status_code=400, detail="employee_id is required")
    return HrmsService.record_punch(db, emp_id, action, note)

# -------------------------------------------------------------
# 4. LEAVE ENDPOINTS
# -------------------------------------------------------------
@router.get("/leaves")
def get_leaves(db: Session = Depends(get_db)):
    return HrmsService.get_leaves(db)

@router.post("/leaves")
def apply_leave(payload: dict, db: Session = Depends(get_db)):
    try:
        return HrmsService.apply_leave(db, payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/leaves/{leave_id}/action")
def update_leave_status(leave_id: str, payload: dict, db: Session = Depends(get_db)):
    status = payload.get("status", "Approved")
    reviewer = payload.get("reviewer", "Gym Owner")
    try:
        return HrmsService.update_leave_status(db, leave_id, status, reviewer)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

# -------------------------------------------------------------
# 5. PAYROLL ENDPOINTS
# -------------------------------------------------------------
@router.get("/payroll")
def get_payroll(month: Optional[str] = None, year: Optional[int] = None, db: Session = Depends(get_db)):
    return HrmsService.get_payroll_records(db, month=month, year=year)

@router.put("/payroll/{payroll_id}/payout")
def process_payout(payroll_id: str, payload: dict, db: Session = Depends(get_db)):
    status = payload.get("status", "Paid")
    try:
        return HrmsService.process_payroll_payout(db, payroll_id, status)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

# -------------------------------------------------------------
# 6. RECRUITMENT ENDPOINTS
# -------------------------------------------------------------
@router.get("/recruitment")
def get_recruitment(db: Session = Depends(get_db)):
    return HrmsService.get_recruitment_overview(db)

@router.put("/recruitment/applicants/{applicant_id}/stage")
def update_applicant_stage(applicant_id: str, payload: dict, db: Session = Depends(get_db)):
    new_stage = payload.get("stage")
    if not new_stage:
        raise HTTPException(status_code=400, detail="stage is required")
    try:
        return HrmsService.update_applicant_stage(db, applicant_id, new_stage)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

# -------------------------------------------------------------
# 7. PERFORMANCE ENDPOINTS
# -------------------------------------------------------------
@router.get("/performance")
def get_performance(db: Session = Depends(get_db)):
    return HrmsService.get_performance_reviews(db)

# -------------------------------------------------------------
# 8. EXIT MANAGEMENT ENDPOINTS
# -------------------------------------------------------------
@router.get("/exit")
def get_exit_requests(db: Session = Depends(get_db)):
    return HrmsService.get_exit_requests(db)

@router.put("/exit/{exit_id}")
def update_exit_status(exit_id: str, payload: dict, db: Session = Depends(get_db)):
    try:
        return HrmsService.update_exit_status(db, exit_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
