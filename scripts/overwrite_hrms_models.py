import os

# 1. Update models/__init__.py
model_file = os.path.join("backend", "src", "models", "__init__.py")
with open(model_file, "r", encoding="utf-8") as f:
    content = f.read()

# Let's clean the previously appended model section to keep it clean and replace it with matching fields
# Find the start of the previous model classes
models_cutoff = content.find("class LeaveRequest(")
if models_cutoff != -1:
    content = content[:models_cutoff]

models_block = """
class LeaveRequest(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "leave_requests"

    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    leave_type: Mapped[str] = mapped_column(String(50), nullable=False)  # Annual|Sick|Casual|Maternity|Unpaid
    from_date: Mapped[date] = mapped_column(Date, nullable=False)
    to_date: Mapped[date] = mapped_column(Date, nullable=False)
    days_requested: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="Pending")  # Pending|Approved|Rejected
    approved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    employee: Mapped["Employee"] = relationship()
    approver: Mapped["User | None"] = relationship()


class LeaveBalance(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "leave_balances"
    __table_args__ = (
        UniqueConstraint("tenant_id", "employee_id", "leave_type", name="uq_leave_balance_emp_type"),
    )

    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    leave_type: Mapped[str] = mapped_column(String(50), nullable=False)
    total_days: Mapped[int] = mapped_column(Integer, default=0)
    used_days: Mapped[int] = mapped_column(Integer, default=0)
    balance: Mapped[int] = mapped_column(Integer, default=0)

    employee: Mapped["Employee"] = relationship()


class SalaryStructure(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "salary_structures"
    __table_args__ = (
        UniqueConstraint("tenant_id", "employee_id", name="uq_salary_structure_emp"),
    )

    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    basic_salary: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    hra: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    other_allowances: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    pf_deduction: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    esi_deduction: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    tds_deduction: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    other_deductions: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    net_salary: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)

    employee: Mapped["Employee"] = relationship()


class Payslip(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "payslips"
    __table_args__ = (
        UniqueConstraint("tenant_id", "employee_id", "month", "year", name="uq_payslip_emp_period"),
    )

    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    basic_salary: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    hra: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    other_allowances: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    pf_deduction: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    esi_deduction: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    tds_deduction: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    other_deductions: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    gross_salary: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    net_salary: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="Processing")  # Processing|Paid
    pdf_url: Mapped[str | None] = mapped_column(String(500))

    employee: Mapped["Employee"] = relationship()
"""

line_ending = "\r\n" if "\r\n" in content else "\n"
content = content + models_block.replace("\n", line_ending)

with open(model_file, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(content)

print("Updated models successfully")
