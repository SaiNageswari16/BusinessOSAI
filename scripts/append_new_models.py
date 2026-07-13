import os

target = os.path.join("backend", "src", "models", "__init__.py")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

models_block = """
class LeaveRequest(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "leave_requests"

    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    leave_type: Mapped[str] = mapped_column(String(50), nullable=False)  # Annual|Sick|Casual|Maternity|Unpaid
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    days: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="Pending")  # Pending|Approved|Rejected
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    employee: Mapped["Employee"] = relationship()
    reviewer: Mapped["User | None"] = relationship()


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
    da: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    lta: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    other_allowances: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    pf: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    tds: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    professional_tax: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    net_salary: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)

    employee: Mapped["Employee"] = relationship()


class Payslip(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "payslips"
    __table_args__ = (
        UniqueConstraint("tenant_id", "employee_id", "pay_period", name="uq_payslip_emp_period"),
    )

    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    pay_period: Mapped[str] = mapped_column(String(20), nullable=False)  # e.g., "2026-07"
    basic_salary: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    allowances: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    deductions: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    net_salary: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="Processing")  # Processing|Paid
    pdf_url: Mapped[str | None] = mapped_column(String(500))

    employee: Mapped["Employee"] = relationship()
"""

line_ending = "\r\n" if "\r\n" in content else "\n"
models_block_file = models_block.replace("\n", line_ending)

with open(target, "a", encoding="utf-8", newline="") as f:
    f.write(models_block_file)

print("Appended LeaveRequest, LeaveBalance, SalaryStructure, and Payslip models successfully")
