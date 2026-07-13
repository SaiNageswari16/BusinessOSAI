import os

# 1. Update leaves.py router to add policy endpoints
leaves_file = os.path.join("backend", "src", "api", "v1", "hrms", "leaves.py")
with open(leaves_file, "r", encoding="utf-8") as f:
    leaves_content = f.read()

leaves_policy_endpoints = """
# ─── Leave Policies Configuration ───────────────────────────────────

from src.models import LeavePolicy
from src.schemas.erp import LeavePolicyCreate, LeavePolicyResponse

@router.get("/leaves/policies", response_model=list[LeavePolicyResponse])
async def list_leave_policies(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(LeavePolicy).where(LeavePolicy.tenant_id == ctx.tenant_id).order_by(LeavePolicy.created_at.desc())
    )
    policies = result.scalars().all()
    
    # Auto-seed mock leave policies if empty
    if not policies:
        seed_policies = [
            LeavePolicy(tenant_id=ctx.tenant_id, name="Standard Annual Scheme", leave_type="Annual", entitled_days=18, applicable_to="All"),
            LeavePolicy(tenant_id=ctx.tenant_id, name="Sick Recovery Allowance", leave_type="Sick", entitled_days=12, applicable_to="All"),
            LeavePolicy(tenant_id=ctx.tenant_id, name="Casual Urgent Leave", leave_type="Casual", entitled_days=6, applicable_to="All"),
        ]
        for p in seed_policies:
            db.add(p)
        await db.commit()
        
        result = await db.execute(
            select(LeavePolicy).where(LeavePolicy.tenant_id == ctx.tenant_id).order_by(LeavePolicy.created_at.desc())
        )
        policies = result.scalars().all()

    return policies


@router.post("/leaves/policies", response_model=LeavePolicyResponse, status_code=status.HTTP_201_CREATED)
async def create_leave_policy(
    payload: LeavePolicyCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:users"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    policy = LeavePolicy(
        tenant_id=ctx.tenant_id,
        **payload.model_dump()
    )
    db.add(policy)
    await db.flush()

    # Dynamically allocate this leave balance to all employees
    result_emps = await db.execute(select(Employee).where(Employee.tenant_id == ctx.tenant_id))
    emps = result_emps.scalars().all()
    for emp in emps:
        # Check if already exists
        existing = await db.scalar(
            select(LeaveBalance).where(
                LeaveBalance.tenant_id == ctx.tenant_id,
                LeaveBalance.employee_id == emp.id,
                LeaveBalance.leave_type == payload.leave_type
            )
        )
        if not existing:
            bal = LeaveBalance(
                tenant_id=ctx.tenant_id,
                employee_id=emp.id,
                leave_type=payload.leave_type,
                total_days=payload.entitled_days,
                used_days=0,
                balance=payload.entitled_days
            )
            db.add(bal)
            
    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="hrms",
        action="created_policy", entity_type="leave_policy", entity_id=policy.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return policy
"""

line_ending = "\r\n" if "\r\n" in leaves_content else "\n"
if "def list_leave_policies" not in leaves_content:
    with open(leaves_file, "a", encoding="utf-8", newline=line_ending) as f:
        f.write(leaves_policy_endpoints.replace("\n", line_ending))


# 2. Update payroll.py router to add PayGrade endpoints
payroll_file = os.path.join("backend", "src", "api", "v1", "hrms", "payroll.py")
with open(payroll_file, "r", encoding="utf-8") as f:
    payroll_content = f.read()

payroll_grade_endpoints = """
# ─── Pay Grade Structure Templates ──────────────────────────────────

from src.models import PayGrade
from src.schemas.erp import PayGradeCreate, PayGradeResponse

@router.get("/payroll/grades", response_model=list[PayGradeResponse])
async def list_pay_grades(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    query = (
        select(PayGrade, Designation)
        .join(Designation, PayGrade.designation_id == Designation.id)
        .where(PayGrade.tenant_id == ctx.tenant_id)
        .order_by(PayGrade.created_at.desc())
    )
    result = await db.execute(query)
    
    grades = []
    for g, desig in result.all():
        grades.append(
            PayGradeResponse(
                id=g.id,
                tenant_id=g.tenant_id,
                name=g.name,
                designation_id=g.designation_id,
                designation_name=desig.name,
                basic_salary=float(g.basic_salary),
                hra=float(g.hra),
                other_allowances=float(g.other_allowances),
                pf_deduction=float(g.pf_deduction),
                esi_deduction=float(g.esi_deduction),
                tds_deduction=float(g.tds_deduction),
                created_at=g.created_at,
                updated_at=g.updated_at,
            )
        )

    # Auto-seed mock pay grades if empty
    if not grades:
        # Get designations
        result_desig = await db.execute(select(Designation).where(Designation.tenant_id == ctx.tenant_id))
        desigs = result_desig.scalars().all()
        for desig in desigs:
            g = PayGrade(
                tenant_id=ctx.tenant_id,
                name=f"{desig.name} Pay Band",
                designation_id=desig.id,
                basic_salary=6000.0,
                hra=2400.0,
                other_allowances=1200.0,
                pf_deduction=720.0,
                esi_deduction=45.0,
                tds_deduction=600.0
            )
            db.add(g)
        await db.commit()

        result = await db.execute(query)
        grades = []
        for g, desig in result.all():
            grades.append(
                PayGradeResponse(
                    id=g.id,
                    tenant_id=g.tenant_id,
                    name=g.name,
                    designation_id=g.designation_id,
                    designation_name=desig.name,
                    basic_salary=float(g.basic_salary),
                    hra=float(g.hra),
                    other_allowances=float(g.other_allowances),
                    pf_deduction=float(g.pf_deduction),
                    esi_deduction=float(g.esi_deduction),
                    tds_deduction=float(g.tds_deduction),
                    created_at=g.created_at,
                    updated_at=g.updated_at,
                )
            )

    return grades


@router.post("/payroll/grades", response_model=PayGradeResponse, status_code=status.HTTP_201_CREATED)
async def create_pay_grade(
    payload: PayGradeCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:users"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Verify designation exists
    desig = await db.get(Designation, payload.designation_id)
    if not desig:
        raise HTTPException(status_code=404, detail="Designation not found")

    # Delete existing grade for this designation if exists
    existing = await db.scalar(
        select(PayGrade).where(PayGrade.designation_id == payload.designation_id, PayGrade.tenant_id == ctx.tenant_id)
    )
    if existing:
        await db.delete(existing)
        await db.flush()

    grade = PayGrade(
        tenant_id=ctx.tenant_id,
        **payload.model_dump()
    )
    db.add(grade)
    await db.flush()

    # Automatically set/update salary structure for all employees mapped to this designation
    result_emps = await db.execute(
        select(Employee).where(
            Employee.designation_id == payload.designation_id,
            Employee.tenant_id == ctx.tenant_id
        )
    )
    emps = result_emps.scalars().all()
    for emp in emps:
        # Check and recreate salary structure
        sal_existing = await db.scalar(
            select(SalaryStructure).where(
                SalaryStructure.employee_id == emp.id,
                SalaryStructure.tenant_id == ctx.tenant_id
            )
        )
        if sal_existing:
            await db.delete(sal_existing)
            await db.flush()

        allowances = payload.hra + payload.other_allowances
        deductions = payload.pf_deduction + payload.esi_deduction + payload.tds_deduction
        net = (payload.basic_salary + allowances) - deductions

        sal = SalaryStructure(
            tenant_id=ctx.tenant_id,
            employee_id=emp.id,
            basic_salary=payload.basic_salary,
            hra=payload.hra,
            other_allowances=payload.other_allowances,
            pf_deduction=payload.pf_deduction,
            esi_deduction=payload.esi_deduction,
            tds_deduction=payload.tds_deduction,
            other_deductions=0.0,
            net_salary=net
        )
        db.add(sal)

    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="hrms",
        action="created_grade", entity_type="pay_grade", entity_id=grade.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    
    return PayGradeResponse(
        id=grade.id,
        tenant_id=grade.tenant_id,
        name=grade.name,
        designation_id=grade.designation_id,
        designation_name=desig.name,
        basic_salary=float(grade.basic_salary),
        hra=float(grade.hra),
        other_allowances=float(grade.other_allowances),
        pf_deduction=float(grade.pf_deduction),
        esi_deduction=float(grade.esi_deduction),
        tds_deduction=float(grade.tds_deduction),
        created_at=grade.created_at,
        updated_at=grade.updated_at
    )
"""

if "def list_pay_grades" not in payroll_content:
    with open(payroll_file, "a", encoding="utf-8", newline=line_ending) as f:
        f.write(payroll_grade_endpoints.replace("\n", line_ending))

print("Appended LeavePolicy and PayGrade endpoints to leaves.py and payroll.py successfully")
