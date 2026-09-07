import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models import Base, TimestampMixin, UUIDPrimaryKeyMixin, TenantScopedMixin


class PaymentReminderPolicy(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "payment_reminder_policies"

    company_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=True, index=True
    )
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    credit_period_days: Mapped[int] = mapped_column(Integer, default=30)  # Default 30-day paylater/credit window
    pre_due_reminder_days: Mapped[list[int] | None] = mapped_column(JSONB, default=lambda: [7, 3, 1, 0])
    overdue_reminder_frequency_hours: Mapped[int] = mapped_column(Integer, default=12)  # Every 12h or 24h
    max_overdue_reminders: Mapped[int] = mapped_column(Integer, default=15)
    
    penalty_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    penalty_type: Mapped[str] = mapped_column(String(50), default="percentage")  # 'percentage', 'fixed', 'daily_percentage'
    penalty_rate: Mapped[float] = mapped_column(Numeric(10, 2), default=2.0)  # 2% or flat fee
    penalty_grace_days: Mapped[int] = mapped_column(Integer, default=0)

    # Channels toggle: {"email": true, "whatsapp": true, "sms": true}
    channels: Mapped[dict | None] = mapped_column(
        JSONB,
        default=lambda: {"email": True, "whatsapp": True, "sms": True},
    )

    email_subject_template: Mapped[str | None] = mapped_column(
        String(255),
        default="Payment Reminder: Invoice {invoice_number} is {due_status} - {company_name}",
    )
    email_body_template: Mapped[str | None] = mapped_column(
        Text,
        default=(
            "Dear {customer_name},\n\n"
            "This is a reminder regarding your invoice {invoice_number} for {company_name}.\n\n"
            "• Invoice Date: {invoice_date}\n"
            "• Due Date: {due_date}\n"
            "• Principal Amount Due: {currency_symbol}{balance_due}\n"
            "• Late Penalty Fee: {currency_symbol}{penalty_amount}\n"
            "• Total Payable Amount: {currency_symbol}{total_payable}\n"
            "• Status: {due_status}\n\n"
            "Please ensure timely settlement to avoid additional late penalties.\n"
            "Thank you,\n{company_name}"
        ),
    )
    whatsapp_template: Mapped[str | None] = mapped_column(
        Text,
        default=(
            "🔔 *Payment Reminder — {company_name}*\n\n"
            "Hello *{customer_name}*,\n"
            "Your invoice *#{invoice_number}* is *{due_status}*.\n\n"
            "📅 *Due Date:* {due_date}\n"
            "💰 *Amount Due:* {currency_symbol}{balance_due}\n"
            "⚠️ *Late Fee:* {currency_symbol}{penalty_amount}\n"
            "💳 *Total Payable:* {currency_symbol}{total_payable}\n\n"
            "Please complete your payment at the earliest. For queries, reply to this message."
        ),
    )
    sms_template: Mapped[str | None] = mapped_column(
        Text,
        default="Reminder from {company_name}: Inv #{invoice_number} of {currency_symbol}{total_payable} is {due_status}. Due: {due_date}. Please pay promptly.",
    )


class PaymentReminderLog(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "payment_reminder_logs"

    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ar_invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("crm_customers.id", ondelete="SET NULL"), nullable=True)
    
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    recipient_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    recipient_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    channel: Mapped[str] = mapped_column(String(50), nullable=False)  # 'email', 'whatsapp', 'sms'
    reminder_type: Mapped[str] = mapped_column(String(50), nullable=False)  # 'pre_due', 'due_today', 'overdue', 'penalty_applied', 'manual'
    days_relative_to_due: Mapped[int] = mapped_column(Integer, default=0)

    amount_due: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    penalty_applied: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    total_payable: Mapped[float] = mapped_column(Numeric(18, 2), default=0)

    status: Mapped[str] = mapped_column(String(50), default="SENT")  # 'SENT', 'FAILED', 'SIMULATED'
    message_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
