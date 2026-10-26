"""One-shot: add monolith-compat columns to the staff service models.

The HRMS API (pulled from the monolith) references field names the
microservice split dropped from the models. This script inserts the missing
columns into models.py after each class's ``id:`` line. Idempotent: columns
already present are skipped.

Run:  python scripts/_staff_model_fill.py
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODELS = ROOT / "src/services/staff/models.py"

# model -> field lines to insert after that class's "    id: Mapped[uuid.UUID]" line.
ADD = {
    "Employee": [
        "    basic_salary: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
        "    joining_date: Mapped[date | None] = mapped_column(Date, nullable=True)",
    ],
    "EmployeeAttendanceScheme": [
        "    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)",
    ],
    "EmployeeBonus": [
        "    bonus_title: Mapped[str | None] = mapped_column(String(150), nullable=True)",
        "    bonus_type: Mapped[str | None] = mapped_column(String(50), nullable=True)",
        "    distribution_month: Mapped[int | None] = mapped_column(Integer, nullable=True)",
        "    distribution_year: Mapped[int | None] = mapped_column(Integer, nullable=True)",
        "    status: Mapped[str | None] = mapped_column(String(30), nullable=True)",
    ],
    "EmployeeLoan": [
        "    loan_type: Mapped[str | None] = mapped_column(String(50), nullable=True)",
        "    principal_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
        "    tenure_months: Mapped[int | None] = mapped_column(Integer, nullable=True)",
        "    monthly_emi: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
        "    amount_repaid: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
        "    remaining_balance: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
        "    start_month: Mapped[int | None] = mapped_column(Integer, nullable=True)",
        "    start_year: Mapped[int | None] = mapped_column(Integer, nullable=True)",
        "    reason: Mapped[str | None] = mapped_column(Text, nullable=True)",
        "    approved_by: Mapped[str | None] = mapped_column(String(150), nullable=True)",
    ],
    "JobOpening": [
        "    location: Mapped[str | None] = mapped_column(String(100), nullable=True)",
        "    type: Mapped[str | None] = mapped_column(String(50), nullable=True)",
        "    experience: Mapped[str | None] = mapped_column(String(100), nullable=True)",
        "    openings: Mapped[int] = mapped_column(Integer, default=1)",
        "    applicants_count: Mapped[int] = mapped_column(Integer, default=0)",
        "    posted_date: Mapped[date | None] = mapped_column(Date, nullable=True)",
        "    threshold_score: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)",
        "    portals: Mapped[str | None] = mapped_column(String(200), nullable=True)",
        "    criteria: Mapped[str | None] = mapped_column(Text, nullable=True)",
    ],
    "CommissionSlabPlan": [
        "    name: Mapped[str | None] = mapped_column(String(150), nullable=True)",
        "    calculation_mode: Mapped[str | None] = mapped_column(String(50), nullable=True)",
        "    is_default: Mapped[bool] = mapped_column(Boolean, default=False)",
        "    slabs: Mapped[list] = mapped_column(JSONB, default=list)",
        "    milestone_bonus_enabled: Mapped[bool] = mapped_column(Boolean, default=False)",
        "    milestone_bonus_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
    ],
    "LearningAssessment": [
        "    title: Mapped[str | None] = mapped_column(String(200), nullable=True)",
        "    course_name: Mapped[str | None] = mapped_column(String(150), nullable=True)",
        "    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)",
        "    participants: Mapped[int] = mapped_column(Integer, default=0)",
        "    avg_score: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)",
        "    status: Mapped[str | None] = mapped_column(String(30), nullable=True)",
    ],
    "LearningCertificate": [
        "    employee_name: Mapped[str | None] = mapped_column(String(200), nullable=True)",
        "    cert_name: Mapped[str | None] = mapped_column(String(200), nullable=True)",
        "    issuer: Mapped[str | None] = mapped_column(String(150), nullable=True)",
        "    issued_date: Mapped[date | None] = mapped_column(Date, nullable=True)",
        "    status: Mapped[str | None] = mapped_column(String(30), nullable=True)",
    ],
    "LearningCourse": [
        "    duration: Mapped[int] = mapped_column(Integer, default=0)",
        "    enrolled: Mapped[int] = mapped_column(Integer, default=0)",
        "    completion: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)",
    ],
    "LeaveBalance": [
        "    total_days: Mapped[float] = mapped_column(Numeric(6, 2), default=0.0)",
        "    used_days: Mapped[float] = mapped_column(Numeric(6, 2), default=0.0)",
    ],
    "OfferLetter": [
        "    candidate: Mapped[str | None] = mapped_column(String(200), nullable=True)",
        "    candidate_email: Mapped[str | None] = mapped_column(String(200), nullable=True)",
        "    role: Mapped[str | None] = mapped_column(String(150), nullable=True)",
        "    ctc: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
        "    offer_date: Mapped[date | None] = mapped_column(Date, nullable=True)",
        "    employee_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)",
        "    email_sent: Mapped[bool] = mapped_column(Boolean, default=False)",
        "    custom_template: Mapped[str | None] = mapped_column(Text, nullable=True)",
    ],
    "PayGrade": [
        "    designation_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)",
        "    basic_salary: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
        "    hra: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
        "    other_allowances: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
        "    pf_deduction: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
        "    esi_deduction: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
        "    tds_deduction: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
    ],
    "Payslip": [
        "    basic_salary: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
        "    hra: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
        "    other_allowances: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
        "    other_deductions: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
        "    gross_salary: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
        "    net_salary: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
        "    status: Mapped[str | None] = mapped_column(String(30), nullable=True)",
        "    template_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)",
    ],
    "PayslipTemplate": [
        "    template_type: Mapped[str | None] = mapped_column(String(50), nullable=True)",
        "    theme_config: Mapped[dict] = mapped_column(JSONB, default=dict)",
        "    header_config: Mapped[dict] = mapped_column(JSONB, default=dict)",
        "    fields_config: Mapped[dict] = mapped_column(JSONB, default=dict)",
        "    notes_config: Mapped[dict] = mapped_column(JSONB, default=dict)",
    ],
    "PerformanceAppraisal": [
        "    employee_name: Mapped[str | None] = mapped_column(String(200), nullable=True)",
        "    department: Mapped[str | None] = mapped_column(String(100), nullable=True)",
        "    period: Mapped[str | None] = mapped_column(String(50), nullable=True)",
        "    rating: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)",
        "    reviewer: Mapped[str | None] = mapped_column(String(150), nullable=True)",
    ],
    "PerformanceGoal": [
        "    employee_name: Mapped[str | None] = mapped_column(String(200), nullable=True)",
        "    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)",
        "    weight: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)",
        "    progress: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)",
    ],
    "PerformanceIncentive": [
        "    employee_name: Mapped[str | None] = mapped_column(String(200), nullable=True)",
        "    department: Mapped[str | None] = mapped_column(String(100), nullable=True)",
        "    type: Mapped[str | None] = mapped_column(String(50), nullable=True)",
        "    basis: Mapped[str | None] = mapped_column(String(150), nullable=True)",
    ],
    "SalaryAdvance": [
        "    approved_by: Mapped[str | None] = mapped_column(String(150), nullable=True)",
    ],
    "SalaryStructure": [
        "    basic_salary: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
        "    hra: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
        "    other_allowances: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
        "    pf_deduction: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
        "    esi_deduction: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
        "    tds_deduction: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
        "    other_deductions: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
        "    net_salary: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
    ],
    "SalesCommission": [
        "    period_month: Mapped[int | None] = mapped_column(Integer, nullable=True)",
        "    period_year: Mapped[int | None] = mapped_column(Integer, nullable=True)",
        "    target_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
        "    achieved_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
        "    commission_rate: Mapped[float] = mapped_column(Numeric(7, 4), default=0.0)",
        "    commission_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
        "    slab_tier: Mapped[int | None] = mapped_column(Integer, nullable=True)",
        "    calculation_mode: Mapped[str | None] = mapped_column(String(50), nullable=True)",
        "    slab_breakdown: Mapped[dict] = mapped_column(JSONB, default=dict)",
        "    status: Mapped[str | None] = mapped_column(String(30), nullable=True)",
        "    notes: Mapped[str | None] = mapped_column(Text, nullable=True)",
    ],
    "AttendanceRecord": [
        "    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)",
        "    is_geofence_verified: Mapped[bool | None] = mapped_column(Boolean, nullable=True)",
    ],
    "Applicant": [
        "    applied_date: Mapped[date | None] = mapped_column(Date, nullable=True)",
        "    expected_salary: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
        "    experience: Mapped[str | None] = mapped_column(String(100), nullable=True)",
        "    job_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)",
        "    job_title: Mapped[str | None] = mapped_column(String(200), nullable=True)",
        "    match_score: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)",
        "    name: Mapped[str | None] = mapped_column(String(200), nullable=True)",
        "    proposed_salary: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)",
        "    resume_text: Mapped[str | None] = mapped_column(Text, nullable=True)",
        "    source: Mapped[str | None] = mapped_column(String(100), nullable=True)",
    ],
}


def _class_fields(text: str, cls_name: str) -> set[str]:
    """Field names already declared inside a class body (for idempotency)."""
    m = re.search(rf"^class {cls_name}\(.*?\n(.*?)(?=^class |\Z)", text, re.M | re.S)
    if not m:
        return set()
    body = m.group(1)
    return set(re.findall(r"^    ([a-z_0-9]+): Mapped", body, re.M))


def main() -> None:
    text = MODELS.read_text(encoding="utf-8")
    lines = text.splitlines(keepends=True)
    out: list[str] = []
    in_class: str | None = None
    existing = {
        name: _class_fields(text, name) for name in ADD
    }
    inserted: dict[str, int] = {}

    for line in lines:
        m = re.match(r"^class (\w+)\(ServiceBase", line)
        if m:
            in_class = m.group(1)
        out.append(line)
        # Insert right after the class's id line (first occurrence per class),
        # skipping fields already declared in that class body.
        if in_class in ADD and line.strip().startswith("id: Mapped[uuid.UUID]"):
            for extra in ADD[in_class]:
                field = extra.split(":")[0].strip()
                if field in existing.get(in_class, set()):
                    continue  # already present — idempotent
                out.append(extra)
                inserted[in_class] = inserted.get(in_class, 0) + 1

    MODELS.write_text("".join(out), encoding="utf-8")
    total = sum(inserted.values())
    print(f"inserted {total} field(s) across {len(inserted)} models:")
    for k, v in inserted.items():
        print(f"  {k}: +{v}")


if __name__ == "__main__":
    main()
