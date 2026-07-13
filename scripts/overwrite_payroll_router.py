import os

target = os.path.join("backend", "src", "api", "v1", "hrms", "payroll.py")

payroll_router_code = """import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUserContext, require_permission
from src.database.init_db import write_audit_log
from src.database.session import get_db
from src.models import Employee, SalaryStructure, Payslip, Designation, Department
from src.schemas.erp import (
    SalaryStructureCreate,
    SalaryStructureResponse,
    PayslipCreate,
    PayslipResponse,
)

router = APIRouter(prefix="/hrms", tags=["HRMS - Payroll"])


@router.get("/salary-structures", response_model=list[SalaryStructureResponse])
async def list_salary_structures(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    query = (
        select(SalaryStructure, Employee, Designation, Department)
        .join(Employee, SalaryStructure.employee_id == Employee.id)
        .outerjoin(Designation, Employee.designation_id == Designation.id)
        .outerjoin(Department, Employee.department_id == Department.id)
        .where(SalaryStructure.tenant_id == ctx.tenant_id)
    )

    result = await db.execute(query)
    
    structures = []
    for sal, emp, desig, dept in result.all():
        structures.append(
            SalaryStructureResponse(
                id=sal.id,
                tenant_id=sal.tenant_id,
                employee_id=sal.employee_id,
                employee_name=emp.full_name,
                designation=desig.name if desig else "N/A",
                department=dept.name if dept else "N/A",
                basic_salary=float(sal.basic_salary),
                hra=float(sal.hra),
                other_allowances=float(sal.other_allowances),
                pf_deduction=float(sal.pf_deduction),
                esi_deduction=float(sal.esi_deduction),
                tds_deduction=float(sal.tds_deduction),
                other_deductions=float(sal.other_deductions),
                net_salary=float(sal.net_salary),
                created_at=sal.created_at,
                updated_at=sal.updated_at,
            )
        )

    # Auto-seed mock salary structures if empty
    if not structures:
        result_emps = await db.execute(select(Employee).where(Employee.tenant_id == ctx.tenant_id))
        emps = result_emps.scalars().all()
        for emp in emps:
            basic = float(emp.basic_salary) if emp.basic_salary is not None else 5000.0
            hra = round(basic * 0.40, 2)
            other = round(basic * 0.20, 2)
            pf = round(basic * 0.12, 2)
            esi = round(basic * 0.0175, 2)
            tds = round(basic * 0.10, 2)
            other_ded = 50.0
            net = (basic + hra + other) - (pf + esi + tds + other_ded)
            
            sal = SalaryStructure(
                tenant_id=ctx.tenant_id,
                employee_id=emp.id,
                basic_salary=basic,
                hra=hra,
                other_allowances=other,
                pf_deduction=pf,
                esi_deduction=esi,
                tds_deduction=tds,
                other_deductions=other_ded,
                net_salary=net
            )
            db.add(sal)
        await db.commit()

        result = await db.execute(query)
        structures = []
        for sal, emp, desig, dept in result.all():
            structures.append(
                SalaryStructureResponse(
                    id=sal.id,
                    tenant_id=sal.tenant_id,
                    employee_id=sal.employee_id,
                    employee_name=emp.full_name,
                    designation=desig.name if desig else "N/A",
                    department=dept.name if dept else "N/A",
                    basic_salary=float(sal.basic_salary),
                    hra=float(sal.hra),
                    other_allowances=float(sal.other_allowances),
                    pf_deduction=float(sal.pf_deduction),
                    esi_deduction=float(sal.esi_deduction),
                    tds_deduction=float(sal.tds_deduction),
                    other_deductions=float(sal.other_deductions),
                    net_salary=float(sal.net_salary),
                    created_at=sal.created_at,
                    updated_at=sal.updated_at,
                )
            )
            
    return structures


@router.post("/salary-structures", response_model=SalaryStructureResponse, status_code=status.HTTP_201_CREATED)
async def create_salary_structure(
    payload: SalaryStructureCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:users"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    emp = await db.scalar(
        select(Employee).where(Employee.id == payload.employee_id, Employee.tenant_id == ctx.tenant_id)
    )
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    existing = await db.scalar(
        select(SalaryStructure).where(
            SalaryStructure.tenant_id == ctx.tenant_id,
            SalaryStructure.employee_id == payload.employee_id
        )
    )
    if existing:
        await db.delete(existing)
        await db.flush()

    allowances = payload.hra + payload.other_allowances
    deductions = payload.pf_deduction + payload.esi_deduction + payload.tds_deduction + payload.other_deductions
    net = (payload.basic_salary + allowances) - deductions

    sal = SalaryStructure(
        tenant_id=ctx.tenant_id,
        basic_salary=payload.basic_salary,
        hra=payload.hra,
        other_allowances=payload.other_allowances,
        pf_deduction=payload.pf_deduction,
        esi_deduction=payload.esi_deduction,
        tds_deduction=payload.tds_deduction,
        other_deductions=payload.other_deductions,
        net_salary=net,
        employee_id=payload.employee_id
    )
    db.add(sal)
    await db.flush()

    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="hrms",
        action="created", entity_type="salary_structure", entity_id=sal.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return sal


@router.get("/payslips", response_model=list[PayslipResponse])
async def list_payslips(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    employee_id: uuid.UUID | None = None,
):
    query = (
        select(Payslip, Employee)
        .join(Employee, Payslip.employee_id == Employee.id)
        .where(Payslip.tenant_id == ctx.tenant_id)
    )
    if employee_id:
        query = query.where(Payslip.employee_id == employee_id)

    result = await db.execute(query)
    
    payslips = []
    for slip, emp in result.all():
        payslips.append(
            PayslipResponse(
                id=slip.id,
                tenant_id=slip.tenant_id,
                employee_id=slip.employee_id,
                employee_name=emp.full_name,
                employee_code=emp.employee_code,
                month=slip.month,
                year=slip.year,
                basic_salary=float(slip.basic_salary),
                hra=float(slip.hra),
                other_allowances=float(slip.other_allowances),
                pf_deduction=float(slip.pf_deduction),
                esi_deduction=float(slip.esi_deduction),
                tds_deduction=float(slip.tds_deduction),
                other_deductions=float(slip.other_deductions),
                gross_salary=float(slip.gross_salary),
                net_salary=float(slip.net_salary),
                status=slip.status,
                pdf_url=slip.pdf_url,
                created_at=slip.created_at,
                updated_at=slip.updated_at,
            )
        )

    # Auto-seed mock payslips if empty
    if not payslips:
        result_structures = await db.execute(
            select(SalaryStructure, Employee)
            .join(Employee, SalaryStructure.employee_id == Employee.id)
            .where(SalaryStructure.tenant_id == ctx.tenant_id)
        )
        for sal, emp in result_structures.all():
            allowances = sal.hra + sal.other_allowances
            deductions = sal.pf_deduction + sal.esi_deduction + sal.tds_deduction + sal.other_deductions
            gross = sal.basic_salary + allowances
            
            # Generate 3 months of payslips
            periods = [(5, 2026), (6, 2026), (7, 2026)]
            for m, y in periods:
                slip = Payslip(
                    tenant_id=ctx.tenant_id,
                    employee_id=emp.id,
                    month=m,
                    year=y,
                    basic_salary=sal.basic_salary,
                    hra=sal.hra,
                    other_allowances=sal.other_allowances,
                    pf_deduction=sal.pf_deduction,
                    esi_deduction=sal.esi_deduction,
                    tds_deduction=sal.tds_deduction,
                    other_deductions=sal.other_deductions,
                    gross_salary=gross,
                    net_salary=sal.net_salary,
                    status="Paid" if m != 7 else "Processing",
                    pdf_url=f"/uploads/payslips/slip_{emp.employee_code}_{y}_{m}.pdf"
                )
                db.add(slip)
        await db.commit()

        # Re-run query
        result = await db.execute(query)
        payslips = []
        for slip, emp in result.all():
            payslips.append(
                PayslipResponse(
                    id=slip.id,
                    tenant_id=slip.tenant_id,
                    employee_id=slip.employee_id,
                    employee_name=emp.full_name,
                    employee_code=emp.employee_code,
                    month=slip.month,
                    year=slip.year,
                    basic_salary=float(slip.basic_salary),
                    hra=float(slip.hra),
                    other_allowances=float(slip.other_allowances),
                    pf_deduction=float(slip.pf_deduction),
                    esi_deduction=float(slip.esi_deduction),
                    tds_deduction=float(slip.tds_deduction),
                    other_deductions=float(slip.other_deductions),
                    gross_salary=float(slip.gross_salary),
                    net_salary=float(slip.net_salary),
                    status=slip.status,
                    pdf_url=slip.pdf_url,
                    created_at=slip.created_at,
                    updated_at=slip.updated_at,
                )
            )
            
    return payslips


@router.post("/payslips/process", response_model=list[PayslipResponse])
async def process_payroll(
    payload: PayslipCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:users"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    sal = await db.scalar(
        select(SalaryStructure).where(
            SalaryStructure.tenant_id == ctx.tenant_id,
            SalaryStructure.employee_id == payload.employee_id
        )
    )
    if not sal:
        raise HTTPException(
            status_code=400,
            detail="Employee does not have a configured Salary Structure. Please configure it first."
        )

    # Delete existing payslip for this employee & period if any to re-run
    existing = await db.scalar(
        select(Payslip).where(
            Payslip.tenant_id == ctx.tenant_id,
            Payslip.employee_id == payload.employee_id,
            Payslip.month == payload.month,
            Payslip.year == payload.year
        )
    )
    if existing:
        await db.delete(existing)
        await db.flush()

    allowances = sal.hra + sal.other_allowances
    deductions = sal.pf_deduction + sal.esi_deduction + sal.tds_deduction + sal.other_deductions
    gross = sal.basic_salary + allowances

    slip = Payslip(
        tenant_id=ctx.tenant_id,
        employee_id=payload.employee_id,
        month=payload.month,
        year=payload.year,
        basic_salary=sal.basic_salary,
        hra=sal.hra,
        other_allowances=sal.other_allowances,
        pf_deduction=sal.pf_deduction,
        esi_deduction=sal.esi_deduction,
        tds_deduction=sal.tds_deduction,
        other_deductions=sal.other_deductions,
        gross_salary=gross,
        net_salary=sal.net_salary,
        status=payload.status,
        pdf_url=f"/uploads/payslips/slip_processed_{payload.year}_{payload.month}.pdf"
    )
    db.add(slip)
    await db.flush()

    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="hrms",
        action="processed", entity_type="payroll", entity_id=slip.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    
    # Query all payslips to return
    query = (
        select(Payslip, Employee)
        .join(Employee, Payslip.employee_id == Employee.id)
        .where(Payslip.tenant_id == ctx.tenant_id)
    )
    result = await db.execute(query)
    
    payslips = []
    for slip, emp in result.all():
        payslips.append(
            PayslipResponse(
                id=slip.id,
                tenant_id=slip.tenant_id,
                employee_id=slip.employee_id,
                employee_name=emp.full_name,
                employee_code=emp.employee_code,
                month=slip.month,
                year=slip.year,
                basic_salary=float(slip.basic_salary),
                hra=float(slip.hra),
                other_allowances=float(slip.other_allowances),
                pf_deduction=float(slip.pf_deduction),
                esi_deduction=float(slip.esi_deduction),
                tds_deduction=float(slip.tds_deduction),
                other_deductions=float(slip.other_deductions),
                gross_salary=float(slip.gross_salary),
                net_salary=float(slip.net_salary),
                status=slip.status,
                pdf_url=slip.pdf_url,
                created_at=slip.created_at,
                updated_at=slip.updated_at,
            )
        )
    return payslips
"""

with open(target, "w", encoding="utf-8", newline="\n") as f:
    f.write(payroll_router_code)

print("Recreated payroll.py router successfully")
