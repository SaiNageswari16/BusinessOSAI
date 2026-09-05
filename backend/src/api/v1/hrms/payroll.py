import uuid
from datetime import datetime, date
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response
from sqlalchemy import func, select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, require_permission
from src.database.init_db import write_audit_log
from src.database.session import get_db
from src.models import (
    Employee,
    SalaryStructure,
    Payslip,
    PayslipTemplate,
    Designation,
    Department,
    EmployeeDocument,
    Tenant,
    EmployeeLoan,
    SalaryAdvance,
    EmployeeBonus,
    SalesCommission,
    CommissionSlabPlan,
    AttendanceRecord,
    LeaveRequest,
)
from src.schemas.erp import (
    SalaryStructureCreate,
    SalaryStructureResponse,
    PayslipCreate,
    PayslipResponse,
    PayslipTemplateCreate,
    PayslipTemplateUpdate,
    PayslipTemplateResponse,
)

def _escape_pdf_text(text: str) -> str:
    return str(text).replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')

def generate_payslip_pdf(
    slip: Payslip,
    emp: Employee,
    company_name: str = "BusinessOS AI Global",
    desig_name: str = "Team Member",
    dept_name: str = "General",
    template_config: dict | None = None,
) -> bytes:
    """Zero-dependency pure Python PDF 1.4 generator for official Salary Slips / Payslips with template support."""
    month_names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    month_str = month_names[slip.month - 1] if 1 <= slip.month <= 12 else f"Month {slip.month}"
    
    cfg = template_config or {}
    hdr = cfg.get("header_config") or {}
    notes = cfg.get("notes_config") or {}
    
    title_text = hdr.get("title_text") or "OFFICIAL SALARY SLIP"
    subtitle_text = hdr.get("subtitle_text") or "CONFIDENTIAL PAYROLL OPERATIONS"
    compliance_notes = notes.get("compliance_notes") or f"Official HRMS Document - Generated securely via {company_name} Compliance Vault"
    signatory_label = notes.get("signatory_label") or "Authorized Finance / Payroll Manager"
    stamp_text = notes.get("stamp_text") or "[Digitally Signed & System Generated Document]"
    
    basic = float(slip.basic_salary or 0)
    hra = float(slip.hra or 0)
    allow = float(slip.other_allowances or 0)
    gross = float(slip.gross_salary or (basic + hra + allow))
    
    pf = float(slip.pf_deduction or 0)
    esi = float(slip.esi_deduction or 0)
    tds = float(slip.tds_deduction or 0)
    other_ded = float(slip.other_deductions or 0)
    total_ded = pf + esi + tds + other_ded
    net = float(slip.net_salary or (gross - total_ded))
    
    emp_name = emp.full_name or "Employee"
    emp_code = emp.employee_code or "EMP-001"
    status_str = (slip.status or "PAID").upper()
    slip_ref = f"SLIP-{str(slip.id)[:8].upper()}" if slip.id else "SLIP-001"
    
    lines = [
        ('F2', 18, 50, 790, company_name),
        ('F2', 8.5, 50, 774, f'{title_text} - {subtitle_text}'),
        ('LINE', 0, 50, 764, 545, 764),
        
        ('F2', 9.5, 50, 742, f'Employee Name: {emp_name}'),
        ('F1', 9, 50, 726, f'Employee Code: {emp_code}'),
        ('F1', 9, 50, 710, f'Designation: {desig_name}'),
        ('F1', 9, 50, 694, f'Department: {dept_name}'),
        
        ('F2', 9.5, 360, 742, f'Pay Period: {month_str} {slip.year}'),
        ('F1', 9, 360, 726, f'Slip Ref No: {slip_ref}'),
        ('F1', 9, 360, 710, f'Disbursement Status: {status_str}'),
        ('F1', 9, 360, 694, f'Generated On: {date.today().strftime("%d %b %Y")}'),
        
        ('LINE', 0, 50, 680, 545, 680),
        ('F2', 11, 50, 660, f'Salary Statement for {month_str} {slip.year}'),
        
        # Table Header
        ('LINE', 0, 50, 645, 545, 645),
        ('F2', 9, 55, 632, 'Earnings Component'),
        ('F2', 9, 210, 632, 'Amount (INR)'),
        ('F2', 9, 320, 632, 'Deductions Component'),
        ('F2', 9, 470, 632, 'Amount (INR)'),
        ('LINE', 0, 50, 622, 545, 622),
        
        # Row 1
        ('F1', 8.5, 55, 608, 'Basic Salary'),
        ('F1', 8.5, 210, 608, f'INR {basic:,.2f}'),
        ('F1', 8.5, 320, 608, 'Provident Fund (PF)'),
        ('F1', 8.5, 470, 608, f'INR {pf:,.2f}'),
        
        # Row 2
        ('F1', 8.5, 55, 592, 'House Rent Allowance (HRA)'),
        ('F1', 8.5, 210, 592, f'INR {hra:,.2f}'),
        ('F1', 8.5, 320, 592, 'ESI Contribution'),
        ('F1', 8.5, 470, 592, f'INR {esi:,.2f}'),
        
        # Row 3
        ('F1', 8.5, 55, 576, 'Other Special Allowances'),
        ('F1', 8.5, 210, 576, f'INR {allow:,.2f}'),
        ('F1', 8.5, 320, 576, 'Tax Deducted at Source (TDS)'),
        ('F1', 8.5, 470, 576, f'INR {tds:,.2f}'),
        
        # Row 4
        ('F1', 8.5, 55, 560, '-'),
        ('F1', 8.5, 210, 560, '-'),
        ('F1', 8.5, 320, 560, 'Other Statutory Deductions'),
        ('F1', 8.5, 470, 560, f'INR {other_ded:,.2f}'),
        
        # Totals Row
        ('LINE', 0, 50, 548, 545, 548),
        ('F2', 9, 55, 534, 'Gross Earnings'),
        ('F2', 9, 210, 534, f'INR {gross:,.2f}'),
        ('F2', 9, 320, 534, 'Total Deductions'),
        ('F2', 9, 470, 534, f'INR {total_ded:,.2f}'),
        ('LINE', 0, 50, 522, 545, 522),
        
        # Net Pay Box
        ('LINE', 0, 50, 500, 545, 500),
        ('F2', 12, 55, 480, f'NET SALARY DISBURSED: INR {net:,.2f}'),
        ('F1', 8.5, 55, 464, f'Status: {status_str} (Direct Bank Transfer / Account Credit)'),
        ('LINE', 0, 50, 450, 545, 450),
        
        # Signatures
        ('F2', 8.5, 50, 360, f'For {company_name}:'),
        ('F1', 8, 50, 310, signatory_label),
        ('F1', 7.5, 50, 298, stamp_text),
        
        ('F2', 8.5, 360, 360, 'Employee Acknowledgement:'),
        ('LINE', 0, 360, 310, 520, 310),
        ('F1', 8, 360, 298, f'{emp_name} (Signature / Acknowledged)'),
        
        ('F1', 7.5, 50, 50, compliance_notes),
    ]
    
    stream_parts = []
    for item in lines:
        if item[0] == 'LINE':
            _, _, x1, y1, x2, y2 = item
            stream_parts.append(f'0.5 w\n{x1} {y1} m\n{x2} {y2} l\nS\n')
        else:
            font_id, size, x, y, text = item
            clean_text = _escape_pdf_text(str(text))
            stream_parts.append(f'BT\n/{font_id} {size} Tf\n{x} {y} Td\n({clean_text}) Tj\nET\n')

    stream_bytes = ''.join(stream_parts).encode('latin-1', errors='replace')
    objects = [
        b'1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
        b'2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
        b'3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n',
        f'4 0 obj\n<< /Length {len(stream_bytes)} >>\nstream\n'.encode('latin-1') + stream_bytes + b'\nendstream\nendobj\n',
        b'5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
        b'6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
    ]

    output = b'%PDF-1.4\n'
    offsets = [len(output)]
    for obj in objects:
        output += obj
        offsets.append(len(output))

    xref_pos = len(output)
    output += f'xref\n0 {len(objects) + 1}\n0000000000 65535 f \n'.encode('latin-1')
    for off in offsets[:-1]:
        output += f'{off:010d} 00000 n \n'.encode('latin-1')
    output += f'trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n'.encode('latin-1')
    return output

router = APIRouter(prefix="/hrms", tags=["HRMS - Payroll"])


@router.get("/salary-structures", response_model=list[SalaryStructureResponse])
async def list_salary_structures(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms_salary_structure"))],
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
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:hrms_salary_structure"))],
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


PREDEFINED_PAYSLIP_TEMPLATES = [
    {
        "id": "tpl-modern-corporate",
        "name": "Modern Corporate (Slate & Blue)",
        "description": "Clean slate & blue contemporary layout with high-contrast net pay hero card and structured earnings & deductions.",
        "template_type": "predefined",
        "is_default": True,
        "theme_config": {
            "primary_color": "#0f172a",
            "accent_color": "#3b82f6",
            "background_color": "#ffffff",
            "header_style": "banner",
            "border_style": "rounded",
            "font_family": "Inter, sans-serif"
        },
        "header_config": {
            "title_text": "OFFICIAL SALARY SLIP",
            "subtitle_text": "Confidential Payroll Operations",
            "show_logo": True,
            "show_gstin": True,
            "show_cin": True,
            "show_address": True,
            "show_contact": True
        },
        "fields_config": {
            "show_employee_code": True,
            "show_department": True,
            "show_designation": True,
            "show_bank_details": True,
            "show_pan": True,
            "show_uan": True,
            "show_worked_days": True
        },
        "notes_config": {
            "compliance_notes": "This is a computer-generated salary slip and requires no physical signature.",
            "disclaimer_text": "Strictly confidential document intended solely for the recipient employee.",
            "signatory_label": "Authorized Finance & Payroll Authority",
            "stamp_text": "Digitally Verified & Approved"
        }
    },
    {
        "id": "tpl-classic-executive",
        "name": "Classic Executive (Royal Navy & Gold)",
        "description": "Traditional executive layout featuring deep navy borders, bronze badge, and formal statutory declarations.",
        "template_type": "predefined",
        "is_default": False,
        "theme_config": {
            "primary_color": "#1e3a8a",
            "accent_color": "#b45309",
            "background_color": "#fafafa",
            "header_style": "bordered",
            "border_style": "classic",
            "font_family": "Georgia, serif"
        },
        "header_config": {
            "title_text": "EXECUTIVE COMPENSATION STATEMENT",
            "subtitle_text": "Corporate Compensation & Benefits Division",
            "show_logo": True,
            "show_gstin": True,
            "show_cin": True,
            "show_address": True,
            "show_contact": True
        },
        "fields_config": {
            "show_employee_code": True,
            "show_department": True,
            "show_designation": True,
            "show_bank_details": True,
            "show_pan": True,
            "show_uan": True,
            "show_worked_days": True
        },
        "notes_config": {
            "compliance_notes": "Preserved under enterprise governance and labor audit compliance standards.",
            "disclaimer_text": "All remuneration figures are strictly private and subject to executive non-disclosure policies.",
            "signatory_label": "Director of Human Capital & Payroll",
            "stamp_text": "Executive Board Verified"
        }
    },
    {
        "id": "tpl-minimalist-clean",
        "name": "Minimalist Clean (Monochrome)",
        "description": "High-density monochrome layout with micro dividers and monospace accounting tables for ultra-clean printing.",
        "template_type": "predefined",
        "is_default": False,
        "theme_config": {
            "primary_color": "#18181b",
            "accent_color": "#71717a",
            "background_color": "#ffffff",
            "header_style": "minimal",
            "border_style": "sharp",
            "font_family": "system-ui, sans-serif"
        },
        "header_config": {
            "title_text": "PAYSLIP STATEMENT",
            "subtitle_text": "Monthly Earnings & Deductions Breakdown",
            "show_logo": True,
            "show_gstin": True,
            "show_cin": False,
            "show_address": True,
            "show_contact": False
        },
        "fields_config": {
            "show_employee_code": True,
            "show_department": True,
            "show_designation": True,
            "show_bank_details": True,
            "show_pan": False,
            "show_uan": False,
            "show_worked_days": True
        },
        "notes_config": {
            "compliance_notes": "Generated by BusinessOS Payroll Cloud.",
            "disclaimer_text": "For personal tax and record keeping purposes only.",
            "signatory_label": "Finance Department",
            "stamp_text": "System Certified"
        }
    },
    {
        "id": "tpl-tech-startup",
        "name": "Tech Startup (Indigo & Emerald)",
        "description": "Modern tech aesthetic with gradient accents, badge pill status, and energetic visual hierarchy.",
        "template_type": "predefined",
        "is_default": False,
        "theme_config": {
            "primary_color": "#4f46e5",
            "accent_color": "#10b981",
            "background_color": "#ffffff",
            "header_style": "gradient",
            "border_style": "pill",
            "font_family": "Inter, sans-serif"
        },
        "header_config": {
            "title_text": "CREW REWARD & PAY VOUCHER",
            "subtitle_text": "People & Talent Ecosystem",
            "show_logo": True,
            "show_gstin": True,
            "show_cin": True,
            "show_address": True,
            "show_contact": True
        },
        "fields_config": {
            "show_employee_code": True,
            "show_department": True,
            "show_designation": True,
            "show_bank_details": True,
            "show_pan": True,
            "show_uan": True,
            "show_worked_days": True
        },
        "notes_config": {
            "compliance_notes": "Thank you for building remarkable products with us every single day.",
            "disclaimer_text": "Transferred directly via automated clearing house (ACH / NEFT).",
            "signatory_label": "Head of People Operations",
            "stamp_text": "Talent Operations Verified"
        }
    },
    {
        "id": "tpl-enterprise-statutory",
        "name": "Enterprise Statutory Compliance",
        "description": "Exhaustive statutory format with detailed PF UAN, ESI IP, Section 192 TDS, and statutory deduction audits.",
        "template_type": "predefined",
        "is_default": False,
        "theme_config": {
            "primary_color": "#064e3b",
            "accent_color": "#0284c7",
            "background_color": "#f8fafc",
            "header_style": "double-border",
            "border_style": "standard",
            "font_family": "Inter, sans-serif"
        },
        "header_config": {
            "title_text": "STATUTORY SALARY & TAX DEDUCTION SLIP",
            "subtitle_text": "Form 16 / Rule 26 Compliant Remuneration Advice",
            "show_logo": True,
            "show_gstin": True,
            "show_cin": True,
            "show_address": True,
            "show_contact": True
        },
        "fields_config": {
            "show_employee_code": True,
            "show_department": True,
            "show_designation": True,
            "show_bank_details": True,
            "show_pan": True,
            "show_uan": True,
            "show_worked_days": True
        },
        "notes_config": {
            "compliance_notes": "Compliant with Payment of Wages Act, Employees Provident Funds & Miscellaneous Provisions Act.",
            "disclaimer_text": "Please preserve this document for personal tax assessment and IT filing.",
            "signatory_label": "Statutory Compliance & Payroll Officer",
            "stamp_text": "Statutory Compliance Audit Passed"
        }
    }
]


# ─── Payslip Template Endpoints ──────────────────────────────────────────────

def _format_payslip_template(ct: Any, is_default_override: bool | None = None) -> dict:
    """Standardize payslip template dictionary with both nested configs and flat styling attributes."""
    if isinstance(ct, dict):
        res = dict(ct)
        theme = res.get("theme_config") or {}
        header = res.get("header_config") or {}
        fields = res.get("fields_config") or {}
        notes = res.get("notes_config") or {}

        res.setdefault("primary_color", theme.get("primary_color", "#1e1b4b"))
        res.setdefault("secondary_color", theme.get("secondary_color", "#312e81"))
        res.setdefault("accent_color", theme.get("accent_color", "#15803d"))
        res.setdefault("background_color", theme.get("background_color", "#ffffff"))
        res.setdefault("text_color", theme.get("text_color", "#0f172a"))
        res.setdefault("font_family", theme.get("font_family", "Inter, sans-serif"))
        res.setdefault("header_layout", theme.get("header_layout", "modern_split"))
        res.setdefault("paper_size", theme.get("paper_size", "A4"))
        res.setdefault("show_company_logo", header.get("show_logo", True))
        res.setdefault("show_company_address", header.get("show_address", True))
        res.setdefault("show_bank_details", fields.get("show_bank_details", True))
        res.setdefault("show_pan_aadhaar", fields.get("show_pan", True))
        res.setdefault("show_leave_summary", fields.get("show_leave_summary", False))
        res.setdefault("show_signatures", notes.get("show_signatures", True))
        res.setdefault("show_watermark", theme.get("show_watermark", False))
        res.setdefault("watermark_text", theme.get("watermark_text", "CONFIDENTIAL"))
        res.setdefault("footer_notes", notes.get("compliance_notes") or notes.get("footer_notes", "System Generated Electronic Salary Certificate • Valid without physical signature"))
        res.setdefault("left_signatory_title", notes.get("left_signatory_title") or "Employee Acknowledgment")
        res.setdefault("right_signatory_title", notes.get("signatory_label") or notes.get("right_signatory_title") or "Authorized Finance Signatory")
        if is_default_override is not None:
            res["is_default"] = is_default_override
        return res

    theme = ct.theme_config or {}
    header = ct.header_config or {}
    fields = ct.fields_config or {}
    notes = ct.notes_config or {}
    is_def = is_default_override if is_default_override is not None else ct.is_default

    return {
        "id": str(ct.id),
        "name": ct.name,
        "description": ct.description,
        "template_type": ct.template_type,
        "is_default": is_def,
        "theme_config": theme,
        "header_config": header,
        "fields_config": fields,
        "notes_config": notes,
        # Flat convenience attributes:
        "primary_color": theme.get("primary_color", "#1e1b4b"),
        "secondary_color": theme.get("secondary_color", "#312e81"),
        "accent_color": theme.get("accent_color", "#15803d"),
        "background_color": theme.get("background_color", "#ffffff"),
        "text_color": theme.get("text_color", "#0f172a"),
        "font_family": theme.get("font_family", "Inter, sans-serif"),
        "header_layout": theme.get("header_layout", "modern_split"),
        "paper_size": theme.get("paper_size", "A4"),
        "show_company_logo": header.get("show_logo", True),
        "show_company_address": header.get("show_address", True),
        "show_bank_details": fields.get("show_bank_details", True),
        "show_pan_aadhaar": fields.get("show_pan", True),
        "show_leave_summary": fields.get("show_leave_summary", False),
        "show_signatures": notes.get("show_signatures", True),
        "show_watermark": theme.get("show_watermark", False),
        "watermark_text": theme.get("watermark_text", "CONFIDENTIAL"),
        "footer_notes": notes.get("compliance_notes") or notes.get("footer_notes", "System Generated Electronic Salary Certificate • Valid without physical signature"),
        "left_signatory_title": notes.get("left_signatory_title") or "Employee Acknowledgment",
        "right_signatory_title": notes.get("signatory_label") or notes.get("right_signatory_title") or "Authorized Finance Signatory",
        "created_at": ct.created_at.isoformat() if hasattr(ct, "created_at") and ct.created_at else None,
    }


@router.get("/templates")
@router.get("/payroll/templates")
async def list_payslip_templates(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all predefined and custom payslip templates with active default marked."""
    custom_records = (
        await db.scalars(
            select(PayslipTemplate)
            .where(PayslipTemplate.tenant_id == ctx.tenant_id)
            .order_by(PayslipTemplate.created_at.desc())
        )
    ).all()

    # Determine which template is default
    default_custom = next((t for t in custom_records if t.is_default), None)
    active_predefined_id = None
    if default_custom and default_custom.template_type == "predefined":
        active_predefined_id = default_custom.description or default_custom.name

    result = []
    # Add predefined
    for pt in PREDEFINED_PAYSLIP_TEMPLATES:
        is_def = False
        if not default_custom:
            is_def = pt.get("is_default", False)
        elif default_custom.template_type == "predefined":
            is_def = (pt["id"] == active_predefined_id or pt["name"] == default_custom.name)
        
        result.append(_format_payslip_template(pt, is_default_override=is_def))

    # Add custom
    for ct in custom_records:
        if ct.template_type != "predefined":
            result.append(_format_payslip_template(ct))

    return result


@router.post("/templates")
@router.post("/payroll/templates")
async def create_payslip_template(
    payload: PayslipTemplateCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new custom payslip template."""
    if payload.is_default:
        await db.execute(
            update(PayslipTemplate)
            .where(PayslipTemplate.tenant_id == ctx.tenant_id)
            .values(is_default=False)
        )

    # Merge flat fields into configs if provided
    theme_cfg = payload.theme_config.copy() if payload.theme_config else {}
    if payload.primary_color: theme_cfg["primary_color"] = payload.primary_color
    if payload.secondary_color: theme_cfg["secondary_color"] = payload.secondary_color
    if payload.accent_color: theme_cfg["accent_color"] = payload.accent_color
    if payload.background_color: theme_cfg["background_color"] = payload.background_color
    if payload.text_color: theme_cfg["text_color"] = payload.text_color
    if payload.font_family: theme_cfg["font_family"] = payload.font_family
    if payload.header_layout: theme_cfg["header_layout"] = payload.header_layout
    if payload.paper_size: theme_cfg["paper_size"] = payload.paper_size
    if payload.show_watermark is not None: theme_cfg["show_watermark"] = payload.show_watermark
    if payload.watermark_text: theme_cfg["watermark_text"] = payload.watermark_text

    header_cfg = payload.header_config.copy() if payload.header_config else {}
    if payload.show_company_logo is not None: header_cfg["show_logo"] = payload.show_company_logo
    if payload.show_company_address is not None: header_cfg["show_address"] = payload.show_company_address

    fields_cfg = payload.fields_config.copy() if payload.fields_config else {}
    if payload.show_bank_details is not None: fields_cfg["show_bank_details"] = payload.show_bank_details
    if payload.show_pan_aadhaar is not None: fields_cfg["show_pan"] = payload.show_pan_aadhaar
    if payload.show_leave_summary is not None: fields_cfg["show_leave_summary"] = payload.show_leave_summary

    notes_cfg = payload.notes_config.copy() if payload.notes_config else {}
    if payload.footer_notes:
        notes_cfg["compliance_notes"] = payload.footer_notes
        notes_cfg["footer_notes"] = payload.footer_notes
    if payload.left_signatory_title: notes_cfg["left_signatory_title"] = payload.left_signatory_title
    if payload.right_signatory_title:
        notes_cfg["signatory_label"] = payload.right_signatory_title
        notes_cfg["right_signatory_title"] = payload.right_signatory_title
    if payload.show_signatures is not None: notes_cfg["show_signatures"] = payload.show_signatures

    tpl = PayslipTemplate(
        tenant_id=ctx.tenant_id,
        name=payload.name,
        description=payload.description,
        template_type="custom",
        is_default=payload.is_default,
        theme_config=theme_cfg,
        header_config=header_cfg,
        fields_config=fields_cfg,
        notes_config=notes_cfg,
    )
    db.add(tpl)
    await db.commit()
    await db.refresh(tpl)
    return _format_payslip_template(tpl)


@router.get("/templates/active")
@router.get("/payroll/templates/active")
async def get_active_payslip_template(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Fetch the company's active default payslip template."""
    custom_default = await db.scalar(
        select(PayslipTemplate)
        .where(PayslipTemplate.tenant_id == ctx.tenant_id, PayslipTemplate.is_default == True)
    )
    if custom_default:
        if custom_default.template_type == "predefined":
            match = next((p for p in PREDEFINED_PAYSLIP_TEMPLATES if p["id"] == custom_default.description or p["name"] == custom_default.name), None)
            if match:
                return _format_payslip_template(match, is_default_override=True)
        return _format_payslip_template(custom_default, is_default_override=True)
    
    # Fallback to default predefined
    def_pre = next((p for p in PREDEFINED_PAYSLIP_TEMPLATES if p.get("is_default")), PREDEFINED_PAYSLIP_TEMPLATES[0])
    return _format_payslip_template(def_pre, is_default_override=True)


@router.get("/public/templates/active")
@router.get("/payroll/public/templates/active")
async def get_public_active_payslip_template(
    tenant_id: str | None = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    """Public endpoint to fetch active template for rendering/downloading."""
    if tenant_id:
        try:
            t_uuid = uuid.UUID(tenant_id)
            custom_default = await db.scalar(
                select(PayslipTemplate)
                .where(PayslipTemplate.tenant_id == t_uuid, PayslipTemplate.is_default == True)
            )
            if custom_default:
                if custom_default.template_type == "predefined":
                    match = next((p for p in PREDEFINED_PAYSLIP_TEMPLATES if p["id"] == custom_default.description or p["name"] == custom_default.name), None)
                    if match:
                        return _format_payslip_template(match, is_default_override=True)
                return _format_payslip_template(custom_default, is_default_override=True)
        except Exception:
            pass

    return _format_payslip_template(PREDEFINED_PAYSLIP_TEMPLATES[0], is_default_override=True)


@router.post("/templates/{template_id}/set-default")
@router.post("/payroll/templates/{template_id}/set-default")
async def set_default_payslip_template(
    template_id: str,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Set a template (predefined or custom) as the active company default."""
    # Reset existing defaults for this tenant
    await db.execute(
        update(PayslipTemplate)
        .where(PayslipTemplate.tenant_id == ctx.tenant_id)
        .values(is_default=False)
    )

    if template_id.startswith("tpl-"):
        # Predefined template
        predefined = next((p for p in PREDEFINED_PAYSLIP_TEMPLATES if p["id"] == template_id), None)
        if not predefined:
            raise HTTPException(status_code=404, detail="Predefined template not found")
        
        # Check if record already exists
        rec = await db.scalar(
            select(PayslipTemplate).where(
                PayslipTemplate.tenant_id == ctx.tenant_id,
                PayslipTemplate.template_type == "predefined",
                PayslipTemplate.description == template_id
            )
        )
        if rec:
            rec.is_default = True
        else:
            rec = PayslipTemplate(
                tenant_id=ctx.tenant_id,
                name=predefined["name"],
                description=template_id,
                template_type="predefined",
                is_default=True,
                theme_config=predefined["theme_config"],
                header_config=predefined["header_config"],
                fields_config=predefined["fields_config"],
                notes_config=predefined["notes_config"],
            )
            db.add(rec)
    else:
        # Custom template by UUID
        try:
            t_uuid = uuid.UUID(template_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid template ID format")
        
        rec = await db.get(PayslipTemplate, t_uuid)
        if not rec or rec.tenant_id != ctx.tenant_id:
            raise HTTPException(status_code=404, detail="Custom template not found")
        rec.is_default = True

    await db.commit()
    return {"message": "Default payslip template updated successfully", "template_id": template_id}


@router.put("/templates/{template_id}")
@router.put("/payroll/templates/{template_id}")
async def update_payslip_template(
    template_id: str,
    payload: PayslipTemplateUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update custom payslip template or tenant override for predefined presets."""
    if template_id.startswith("tpl-"):
        predefined = next((p for p in PREDEFINED_PAYSLIP_TEMPLATES if p["id"] == template_id), None)
        rec = await db.scalar(
            select(PayslipTemplate).where(
                PayslipTemplate.tenant_id == ctx.tenant_id,
                PayslipTemplate.template_type == "predefined",
                PayslipTemplate.description == template_id
            )
        )
        if not rec:
            rec = PayslipTemplate(
                tenant_id=ctx.tenant_id,
                name=payload.name or (predefined["name"] if predefined else "Custom Corporate"),
                description=template_id,
                template_type="predefined",
                is_default=bool(payload.is_default),
                theme_config=dict(predefined["theme_config"]) if predefined else {},
                header_config=dict(predefined["header_config"]) if predefined else {},
                fields_config=dict(predefined["fields_config"]) if predefined else {},
                notes_config=dict(predefined["notes_config"]) if predefined else {},
            )
            db.add(rec)
            await db.flush()
    else:
        try:
            t_uuid = uuid.UUID(template_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid template ID format")
        
        rec = await db.get(PayslipTemplate, t_uuid)
        if not rec or rec.tenant_id != ctx.tenant_id:
            raise HTTPException(status_code=404, detail="Template not found")

    if payload.is_default is True:
        await db.execute(
            update(PayslipTemplate)
            .where(PayslipTemplate.tenant_id == ctx.tenant_id)
            .values(is_default=False)
        )
        rec.is_default = True

    if payload.name is not None:
        rec.name = payload.name
    if payload.description is not None:
        rec.description = payload.description

    theme_cfg = dict(rec.theme_config) if rec.theme_config else {}
    if payload.theme_config is not None:
        theme_cfg.update(payload.theme_config)
    if payload.primary_color: theme_cfg["primary_color"] = payload.primary_color
    if payload.secondary_color: theme_cfg["secondary_color"] = payload.secondary_color
    if payload.accent_color: theme_cfg["accent_color"] = payload.accent_color
    if payload.background_color: theme_cfg["background_color"] = payload.background_color
    if payload.text_color: theme_cfg["text_color"] = payload.text_color
    if payload.font_family: theme_cfg["font_family"] = payload.font_family
    if payload.header_layout: theme_cfg["header_layout"] = payload.header_layout
    if payload.paper_size: theme_cfg["paper_size"] = payload.paper_size
    if payload.show_watermark is not None: theme_cfg["show_watermark"] = payload.show_watermark
    if payload.watermark_text: theme_cfg["watermark_text"] = payload.watermark_text
    rec.theme_config = theme_cfg

    header_cfg = dict(rec.header_config) if rec.header_config else {}
    if payload.header_config is not None:
        header_cfg.update(payload.header_config)
    if payload.show_company_logo is not None: header_cfg["show_logo"] = payload.show_company_logo
    if payload.show_company_address is not None: header_cfg["show_address"] = payload.show_company_address
    rec.header_config = header_cfg

    fields_cfg = dict(rec.fields_config) if rec.fields_config else {}
    if payload.fields_config is not None:
        fields_cfg.update(payload.fields_config)
    if payload.show_bank_details is not None: fields_cfg["show_bank_details"] = payload.show_bank_details
    if payload.show_pan_aadhaar is not None: fields_cfg["show_pan"] = payload.show_pan_aadhaar
    if payload.show_leave_summary is not None: fields_cfg["show_leave_summary"] = payload.show_leave_summary
    rec.fields_config = fields_cfg

    notes_cfg = dict(rec.notes_config) if rec.notes_config else {}
    if payload.notes_config is not None:
        notes_cfg.update(payload.notes_config)
    if payload.footer_notes:
        notes_cfg["compliance_notes"] = payload.footer_notes
        notes_cfg["footer_notes"] = payload.footer_notes
    if payload.left_signatory_title: notes_cfg["left_signatory_title"] = payload.left_signatory_title
    if payload.right_signatory_title:
        notes_cfg["signatory_label"] = payload.right_signatory_title
        notes_cfg["right_signatory_title"] = payload.right_signatory_title
    if payload.show_signatures is not None: notes_cfg["show_signatures"] = payload.show_signatures
    rec.notes_config = notes_cfg

    await db.commit()
    await db.refresh(rec)
    return _format_payslip_template(rec)


@router.delete("/templates/{template_id}")
@router.delete("/payroll/templates/{template_id}")
async def delete_payslip_template(
    template_id: str,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a custom payslip template."""
    try:
        t_uuid = uuid.UUID(template_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid template ID format")
    
    rec = await db.get(PayslipTemplate, t_uuid)
    if not rec or rec.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Template not found")

    await db.delete(rec)
    await db.commit()
    return {"message": "Template deleted successfully"}


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

    # If the user does not have company-wide payroll viewing permissions, strictly isolate to their own payslips
    user_id = getattr(ctx.user, "id", None)
    user_email = getattr(ctx.user, "email", None)
    if not (ctx.has_permission("view:hrms_payslips") or ctx.has_permission("manage:hrms") or ctx.is_tenant_owner):
        query = query.where((Employee.user_id == user_id) | (Employee.email == user_email))

    if employee_id:
        query = query.where(Payslip.employee_id == employee_id)

    result = await db.execute(query.order_by(Payslip.year.desc(), Payslip.month.desc(), Employee.full_name.asc()))
    
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
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    emp = await db.get(Employee, payload.employee_id)
    if not emp or emp.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Employee not found")

    sal = await db.scalar(
        select(SalaryStructure).where(
            SalaryStructure.tenant_id == ctx.tenant_id,
            SalaryStructure.employee_id == payload.employee_id
        )
    )
    if not sal:
        # Auto-create compliant SalaryStructure using employee's recorded basic salary
        b_sal = float(emp.basic_salary) if emp.basic_salary and float(emp.basic_salary) > 0 else 30000.0
        hra_val = round(b_sal * 0.40)
        other_val = round(b_sal * 0.10)
        gross_val = b_sal + hra_val + other_val
        pf_val = round(min(b_sal, 15000.0) * 0.12)
        esi_val = round(gross_val * 0.0075) if gross_val <= 21000.0 else 0.0
        tds_val = round(((gross_val * 12 - 700000.0) * 0.10) / 12) if (gross_val * 12) > 700000.0 else 0.0
        ded_val = pf_val + esi_val + tds_val
        net_val = gross_val - ded_val

        sal = SalaryStructure(
            tenant_id=ctx.tenant_id,
            employee_id=emp.id,
            basic_salary=b_sal,
            hra=hra_val,
            other_allowances=other_val,
            pf_deduction=pf_val,
            esi_deduction=esi_val,
            tds_deduction=tds_val,
            other_deductions=0.0,
            net_salary=net_val,
        )
        db.add(sal)
        await db.flush()

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

    # Check for active template
    active_tpl = await db.scalar(
        select(PayslipTemplate)
        .where(PayslipTemplate.tenant_id == ctx.tenant_id, PayslipTemplate.is_default == True)
    )
    tpl_config = None
    tpl_id = None
    if active_tpl:
        tpl_id = active_tpl.id if active_tpl.template_type != "predefined" else None
        tpl_config = {
            "theme_config": active_tpl.theme_config or {},
            "header_config": active_tpl.header_config or {},
            "fields_config": active_tpl.fields_config or {},
            "notes_config": active_tpl.notes_config or {},
        }

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
        template_id=tpl_id,
        pdf_url=f"/vault/payslips/slip_pending.pdf"
    )
    db.add(slip)
    await db.flush()

    tenant = await db.scalar(select(Tenant).where(Tenant.id == ctx.tenant_id))
    comp_name = tenant.name if tenant else "BusinessOS AI Global"
    desig_name = "Team Member"
    if emp and emp.designation_id:
        desig = await db.get(Designation, emp.designation_id)
        if desig:
            desig_name = desig.name
    dept_name = "General"
    if emp and emp.department_id:
        dept = await db.get(Department, emp.department_id)
        if dept:
            dept_name = dept.name

    pdf_bytes = generate_payslip_pdf(slip, emp, comp_name, desig_name, dept_name, template_config=tpl_config)
    try:
        vault_dir = Path("static/vault/payslips")
        vault_dir.mkdir(parents=True, exist_ok=True)
        (vault_dir / f"{slip.id}.pdf").write_bytes(pdf_bytes)
    except Exception as e:
        print(f"[PAYSLIP VAULT PDF NOTICE]: {e}")

    slip.pdf_url = f"/vault/payslips/{slip.id}.pdf"

    # Auto-archive to EmployeeDocument (Document Vault)
    month_names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    m_title = month_names[payload.month - 1] if 1 <= payload.month <= 12 else f"Month {payload.month}"
    doc_title = f"Salary Slip - {m_title} {payload.year}"

    old_doc = await db.scalar(
        select(EmployeeDocument).where(
            EmployeeDocument.tenant_id == ctx.tenant_id,
            EmployeeDocument.employee_id == payload.employee_id,
            EmployeeDocument.document_name == doc_title
        )
    )
    if old_doc:
        await db.delete(old_doc)
        await db.flush()

    doc_entry = EmployeeDocument(
        tenant_id=ctx.tenant_id,
        employee_id=payload.employee_id,
        document_name=doc_title,
        document_type="Payslip",
        file_path=f"/vault/payslips/{slip.id}.pdf",
        upload_date=date.today(),
        status="Valid",
    )
    db.add(doc_entry)

    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id, module="hrms",
        action="processed", entity_type="payroll", entity_id=slip.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()


import calendar

# ── Attendance Sheet Matrix & Synchronization Endpoints ───────────────

@router.get("/attendance-sheet")
@router.get("/payroll/attendance-sheet")
async def get_monthly_attendance_sheet(
    month: int = Query(7, ge=1, le=12),
    year: int = Query(2026, ge=2020, le=2030),
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    """
    Returns monthly day-wise attendance matrix, shift details, approved leaves,
    Loss of Pay (LOP) days, payable days, and calculated payroll figures.
    """
    days_in_month = calendar.monthrange(year, month)[1]
    start_d = date(year, month, 1)
    end_d = date(year, month, days_in_month)

    employees = (
        await db.scalars(
            select(Employee)
            .options(
                selectinload(Employee.department),
                selectinload(Employee.designation),
            )
            .where(
                Employee.tenant_id == ctx.tenant_id,
                Employee.status.in_(["Active", "active", "Probation", "probation"])
            )
        )
    ).all()
    if not employees:
        employees = (
            await db.scalars(
                select(Employee)
                .options(
                    selectinload(Employee.department),
                    selectinload(Employee.designation),
                )
                .where(Employee.tenant_id == ctx.tenant_id)
            )
        ).all()

    # Query all attendance records for the month
    att_records = (
        await db.scalars(
            select(AttendanceRecord).where(
                AttendanceRecord.tenant_id == ctx.tenant_id,
                AttendanceRecord.date >= start_d,
                AttendanceRecord.date <= end_d,
            )
        )
    ).all()

    # Query all approved leave requests for the month
    leaves = (
        await db.scalars(
            select(LeaveRequest).where(
                LeaveRequest.tenant_id == ctx.tenant_id,
                LeaveRequest.status.in_(["Approved", "approved"]),
                LeaveRequest.from_date <= end_d,
                LeaveRequest.to_date >= start_d,
            )
        )
    ).all()

    # Query salary structures
    structures = {
        s.employee_id: s
        for s in (await db.scalars(select(SalaryStructure).where(SalaryStructure.tenant_id == ctx.tenant_id))).all()
    }

    # Map attendance by (employee_id, day)
    att_map = {(a.employee_id, a.date.day): a for a in att_records}

    result_rows = []
    for idx, emp in enumerate(employees):
        struct = structures.get(emp.id)
        base_sal = float(struct.basic_salary) if struct else (float(emp.basic_salary) if emp.basic_salary else 45000.0)

        # Build 31 day matrix
        day_records = {}
        present_count = 0.0
        paid_leaves_count = 0.0
        lop_count = 0.0
        ot_hours = 0.0

        for d in range(1, days_in_month + 1):
            curr_date = date(year, month, d)
            weekday = curr_date.weekday()  # 5=Sat, 6=Sun
            att = att_map.get((emp.id, d))

            if att:
                status_code = "P" if att.status in ["Present", "present"] else ("HD" if att.status in ["Half Day", "half_day"] else ("A" if att.status in ["Absent", "absent"] else "PL"))
                if status_code == "P":
                    present_count += 1.0
                elif status_code == "HD":
                    present_count += 0.5
                    lop_count += 0.5
                elif status_code == "A":
                    lop_count += 1.0
                elif status_code == "PL":
                    paid_leaves_count += 1.0
                day_records[d] = status_code
                if att.hours_worked and float(att.hours_worked) > 8:
                    ot_hours += (float(att.hours_worked) - 8.0)
            else:
                if weekday in (5, 6):
                    day_records[d] = "WO"
                else:
                    # Check approved leaves
                    emp_leave = next((l for l in leaves if l.employee_id == emp.id and l.from_date <= curr_date <= l.to_date), None)
                    if emp_leave:
                        day_records[d] = "PL"
                        paid_leaves_count += 1.0
                    else:
                        day_records[d] = "P"
                        present_count += 1.0

        payable_days = max(0.0, float(days_in_month) - float(lop_count))
        proration = payable_days / float(days_in_month)

        raw_basic = base_sal
        raw_hra = float(struct.hra) if struct else round(raw_basic * 0.40)
        raw_allow = float(struct.other_allowances) if struct else round(raw_basic * 0.10)

        prorated_basic = round(raw_basic * proration)
        prorated_hra = round(raw_hra * proration)
        prorated_allow = round(raw_allow * proration)

        hourly_rate = (raw_basic + raw_hra + raw_allow) / (days_in_month * 8)
        ot_pay = round(hourly_rate * ot_hours * 1.5)

        gross = prorated_basic + prorated_hra + prorated_allow + ot_pay
        pf = round(min(prorated_basic, 15000.0) * 0.12) if prorated_basic > 0 else 0
        esi = round(gross * 0.0075) if (gross > 0 and gross <= 21000.0) else 0
        annual_gross = gross * 12
        tds = round(((annual_gross - 700000.0) * 0.10) / 12) if annual_gross > 700000.0 else 0
        loan_ded = float(struct.other_deductions) if struct else 0.0

        total_ded = pf + esi + tds + loan_ded
        net_pay = max(0.0, gross - total_ded)

        result_rows.append({
            "employee_id": str(emp.id),
            "employee_code": emp.employee_code or f"EMP-{100+idx}",
            "full_name": emp.full_name,
            "department": getattr(emp.department, "name", "Operations") if getattr(emp, "department", None) else "Operations",
            "designation": getattr(emp.designation, "name", "Executive") if getattr(emp, "designation", None) else "Executive",
            "shift_name": "General (09:00 - 18:00)" if idx % 2 == 0 else "Morning (07:00 - 16:00)",
            "total_days": days_in_month,
            "working_days": days_in_month - 8,
            "present_days": present_count,
            "paid_leaves": paid_leaves_count,
            "lop_days": lop_count,
            "payable_days": payable_days,
            "overtime_hours": ot_hours,
            "late_count": 0,
            "day_records": day_records,
            "base_salary": base_sal,
            "prorated_basic": prorated_basic,
            "prorated_hra": prorated_hra,
            "prorated_allowances": prorated_allow,
            "overtime_pay": ot_pay,
            "gross_earnings": gross,
            "pf_deduction": pf,
            "esi_deduction": esi,
            "tds_deduction": tds,
            "loan_deduction": loan_ded,
            "total_deductions": total_ded,
            "net_payable": net_pay,
            "status": "Computed",
        })

    return {
        "month": month,
        "year": year,
        "days_in_month": days_in_month,
        "total_employees": len(result_rows),
        "records": result_rows
    }


@router.post("/sync-attendance-sheet")
@router.post("/payroll/sync-attendance-sheet")
async def sync_monthly_attendance_sheet(
    payload: dict,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Synchronizes modified attendance records and re-computes payroll for the month.
    """
    month = int(payload.get("month", 7))
    year = int(payload.get("year", 2026))
    records = payload.get("records", [])

    days_in_month = calendar.monthrange(year, month)[1]

    updated_count = 0
    for r in records:
        emp_code = r.get("employee_code") or r.get("Employee Code")
        emp = None
        if emp_code:
            emp = await db.scalar(
                select(Employee).where(
                    Employee.tenant_id == ctx.tenant_id,
                    Employee.employee_code == str(emp_code).strip()
                )
            )
        if not emp and r.get("employee_id"):
            try:
                e_id = uuid.UUID(r["employee_id"])
                emp = await db.get(Employee, e_id)
            except ValueError:
                pass

        if not emp:
            continue

        day_records = r.get("day_records") or {}
        for d_str, code in day_records.items():
            try:
                d_num = int(d_str)
                if not (1 <= d_num <= days_in_month):
                    continue
                d_obj = date(year, month, d_num)

                existing_att = await db.scalar(
                    select(AttendanceRecord).where(
                        AttendanceRecord.tenant_id == ctx.tenant_id,
                        AttendanceRecord.employee_id == emp.id,
                        AttendanceRecord.date == d_obj
                    )
                )

                status_mapped = "Present" if code == "P" else ("Half Day" if code == "HD" else ("Absent" if code in ["A", "UL"] else "On Leave"))

                if existing_att:
                    existing_att.status = status_mapped
                    existing_att.method = "Manual"
                else:
                    new_att = AttendanceRecord(
                        tenant_id=ctx.tenant_id,
                        employee_id=emp.id,
                        date=d_obj,
                        status=status_mapped,
                        method="Manual",
                        hours_worked=8.0 if status_mapped == "Present" else (4.0 if status_mapped == "Half Day" else 0.0)
                    )
                    db.add(new_att)
                updated_count += 1
            except Exception:
                pass

    await db.commit()
    return {
        "message": f"Successfully synchronized attendance sheet for {len(records)} employees ({updated_count} day records updated).",
        "month": month,
        "year": year,
        "records_synced": len(records)
    }


@router.post("/payslips/process-batch", response_model=list[PayslipResponse])
async def process_batch_payroll(
    payload: dict,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """One-click batch payroll processing for all active employees of the organization factoring in attendance and leaves."""
    m = int(payload.get("month", 7))
    y = int(payload.get("year", 2026))
    p_status = str(payload.get("status", "Paid"))

    days_in_month = calendar.monthrange(y, m)[1]
    start_d = date(y, m, 1)
    end_d = date(y, m, days_in_month)

    employees = (
        await db.scalars(
            select(Employee).where(
                Employee.tenant_id == ctx.tenant_id,
                Employee.status.in_(["Active", "active", "Probation", "probation"])
            )
        )
    ).all()

    if not employees:
        employees = (
            await db.scalars(
                select(Employee).where(Employee.tenant_id == ctx.tenant_id)
            )
        ).all()

    target_emp_ids = payload.get("employee_ids")
    if target_emp_ids and isinstance(target_emp_ids, list) and len(target_emp_ids) > 0:
        target_str_set = {str(eid).strip() for eid in target_emp_ids}
        employees = [e for e in employees if str(e.id) in target_str_set]

    tenant = await db.scalar(select(Tenant).where(Tenant.id == ctx.tenant_id))
    comp_name = tenant.name if tenant else "BusinessOS AI Global"

    # Query attendance records for this month
    att_records = (
        await db.scalars(
            select(AttendanceRecord).where(
                AttendanceRecord.tenant_id == ctx.tenant_id,
                AttendanceRecord.date >= start_d,
                AttendanceRecord.date <= end_d,
            )
        )
    ).all()

    # Check for active template
    active_tpl = await db.scalar(
        select(PayslipTemplate)
        .where(PayslipTemplate.tenant_id == ctx.tenant_id, PayslipTemplate.is_default == True)
    )
    tpl_config = None
    tpl_id = None
    if active_tpl:
        tpl_id = active_tpl.id if active_tpl.template_type != "predefined" else None
        tpl_config = {
            "theme_config": active_tpl.theme_config or {},
            "header_config": active_tpl.header_config or {},
            "fields_config": active_tpl.fields_config or {},
            "notes_config": active_tpl.notes_config or {},
        }

    vault_dir = Path("static/vault/payslips")
    vault_dir.mkdir(parents=True, exist_ok=True)
    month_names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    m_title = month_names[m - 1] if 1 <= m <= 12 else f"Month {m}"
    doc_title = f"Salary Slip - {m_title} {y}"

    for emp in employees:
        sal = await db.scalar(
            select(SalaryStructure).where(
                SalaryStructure.tenant_id == ctx.tenant_id,
                SalaryStructure.employee_id == emp.id
            )
        )
        if not sal:
            b_sal = float(emp.basic_salary) if emp.basic_salary and float(emp.basic_salary) > 0 else 30000.0
            hra_val = round(b_sal * 0.40)
            other_val = round(b_sal * 0.10)
            gross_val = b_sal + hra_val + other_val
            pf_val = round(min(b_sal, 15000.0) * 0.12)
            esi_val = round(gross_val * 0.0075) if gross_val <= 21000.0 else 0.0
            tds_val = round(((gross_val * 12 - 700000.0) * 0.10) / 12) if (gross_val * 12) > 700000.0 else 0.0
            ded_val = pf_val + esi_val + tds_val
            net_val = gross_val - ded_val

            sal = SalaryStructure(
                tenant_id=ctx.tenant_id,
                employee_id=emp.id,
                basic_salary=b_sal,
                hra=hra_val,
                other_allowances=other_val,
                pf_deduction=pf_val,
                esi_deduction=esi_val,
                tds_deduction=tds_val,
                other_deductions=0.0,
                net_salary=net_val,
            )
            db.add(sal)
            await db.flush()

        # Calculate Loss of Pay (LOP) days from attendance records
        emp_att = [a for a in att_records if a.employee_id == emp.id]
        lop_days = 0.0
        for a in emp_att:
            if a.status in ["Absent", "absent"]:
                lop_days += 1.0
            elif a.status in ["Half Day", "half_day"]:
                lop_days += 0.5

        payable_days = max(0.0, float(days_in_month) - lop_days)
        proration = payable_days / float(days_in_month)

        prorated_basic = round(float(sal.basic_salary) * proration)
        prorated_hra = round(float(sal.hra) * proration)
        prorated_allow = round(float(sal.other_allowances) * proration)

        gross = prorated_basic + prorated_hra + prorated_allow
        pf = round(min(prorated_basic, 15000.0) * 0.12) if prorated_basic > 0 else 0
        esi = round(gross * 0.0075) if (gross > 0 and gross <= 21000.0) else 0
        annual_gross = gross * 12
        tds = round(((annual_gross - 700000.0) * 0.10) / 12) if annual_gross > 700000.0 else 0
        other_ded = float(sal.other_deductions or 0.0)

        total_ded = pf + esi + tds + other_ded
        net_salary = max(0.0, gross - total_ded)

        existing = await db.scalar(
            select(Payslip).where(
                Payslip.tenant_id == ctx.tenant_id,
                Payslip.employee_id == emp.id,
                Payslip.month == m,
                Payslip.year == y
            )
        )
        if existing:
            await db.delete(existing)
            await db.flush()

        slip = Payslip(
            tenant_id=ctx.tenant_id,
            employee_id=emp.id,
            month=m,
            year=y,
            basic_salary=prorated_basic,
            hra=prorated_hra,
            other_allowances=prorated_allow,
            pf_deduction=pf,
            esi_deduction=esi,
            tds_deduction=tds,
            other_deductions=other_ded,
            gross_salary=gross,
            net_salary=net_salary,
            status=p_status,
            template_id=tpl_id,
            pdf_url=f"/vault/payslips/slip_pending.pdf"
        )
        db.add(slip)
        await db.flush()

        desig_name = "Team Member"
        if emp.designation_id:
            desig = await db.get(Designation, emp.designation_id)
            if desig:
                desig_name = desig.name
        dept_name = "General"
        if emp.department_id:
            dept = await db.get(Department, emp.department_id)
            if dept:
                dept_name = dept.name

        try:
            pdf_bytes = generate_payslip_pdf(slip, emp, comp_name, desig_name, dept_name, template_config=tpl_config)
            (vault_dir / f"{slip.id}.pdf").write_bytes(pdf_bytes)
            slip.pdf_url = f"/vault/payslips/{slip.id}.pdf"
        except Exception as e:
            print(f"[BATCH PAYSLIP PDF ERROR]: {e}")

        # Vault document sync
        old_doc = await db.scalar(
            select(EmployeeDocument).where(
                EmployeeDocument.tenant_id == ctx.tenant_id,
                EmployeeDocument.employee_id == emp.id,
                EmployeeDocument.document_name == doc_title
            )
        )
        if old_doc:
            await db.delete(old_doc)
            await db.flush()

        doc_entry = EmployeeDocument(
            tenant_id=ctx.tenant_id,
            employee_id=emp.id,
            document_name=doc_title,
            document_type="Payslip",
            file_path=f"/vault/payslips/{slip.id}.pdf",
            upload_date=date.today(),
            status="Valid",
        )
        db.add(doc_entry)

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


@router.get("/payslips/{id}", response_model=PayslipResponse)
async def get_payslip(
    id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    slip = await db.get(Payslip, id)
    if not slip or slip.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Payslip not found")
    emp = await db.get(Employee, slip.employee_id)
    return PayslipResponse(
        id=slip.id,
        tenant_id=slip.tenant_id,
        employee_id=slip.employee_id,
        employee_name=emp.full_name if emp else "Employee",
        employee_code=emp.employee_code if emp else "EMP-001",
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


@router.get("/payroll/employee-history/{employee_id}")
async def get_employee_payroll_history(
    employee_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Returns exhaustive month-by-month payroll history, earnings, deductions, and aggregated metrics for an employee.
    """
    emp = await db.get(Employee, employee_id)
    if not emp or emp.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Employee not found")

    desig_name = "N/A"
    if emp.designation_id:
        desig = await db.get(Designation, emp.designation_id)
        if desig:
            desig_name = desig.name

    dept_name = "N/A"
    if emp.department_id:
        dept = await db.get(Department, emp.department_id)
        if dept:
            dept_name = dept.name

    struct = await db.scalar(
        select(SalaryStructure).where(
            SalaryStructure.tenant_id == ctx.tenant_id,
            SalaryStructure.employee_id == employee_id
        )
    )

    slips = (
        await db.scalars(
            select(Payslip)
            .where(
                Payslip.tenant_id == ctx.tenant_id,
                Payslip.employee_id == employee_id
            )
            .order_by(Payslip.year.desc(), Payslip.month.desc())
        )
    ).all()

    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    history_items = []
    total_gross = 0.0
    total_net = 0.0
    total_deductions = 0.0

    for s in slips:
        g = float(s.gross_salary or 0)
        n = float(s.net_salary or 0)
        pf = float(s.pf_deduction or 0)
        esi = float(s.esi_deduction or 0)
        tds = float(s.tds_deduction or 0)
        od = float(s.other_deductions or 0)
        d = pf + esi + tds + od

        total_gross += g
        total_net += n
        total_deductions += d

        m_idx = max(1, min(12, s.month))
        history_items.append({
            "id": str(s.id),
            "month": s.month,
            "year": s.year,
            "period_label": f"{month_names[m_idx - 1]} {s.year}",
            "basic_salary": float(s.basic_salary or 0),
            "hra": float(s.hra or 0),
            "other_allowances": float(s.other_allowances or 0),
            "gross_salary": g,
            "pf_deduction": pf,
            "esi_deduction": esi,
            "tds_deduction": tds,
            "other_deductions": od,
            "total_deductions": d,
            "net_salary": n,
            "status": s.status or "Paid",
            "pdf_url": s.pdf_url,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        })

    avg_monthly_net = round(total_net / len(slips), 2) if slips else 0.0

    return {
        "employee": {
            "id": str(emp.id),
            "full_name": emp.full_name,
            "employee_code": emp.employee_code,
            "email": emp.email,
            "phone": emp.phone,
            "department": dept_name,
            "designation": desig_name,
            "joining_date": emp.joining_date.isoformat() if hasattr(emp, "joining_date") and emp.joining_date else None,
            "status": emp.status,
            "base_salary": float(struct.basic_salary) if struct else (float(emp.basic_salary) if emp.basic_salary else 0.0),
        },
        "summary": {
            "total_runs": len(history_items),
            "total_gross_paid": round(total_gross, 2),
            "total_net_paid": round(total_net, 2),
            "total_deductions": round(total_deductions, 2),
            "avg_monthly_net": avg_monthly_net,
        },
        "history": history_items,
    }


@router.get("/public/payslips/{id}", response_model=PayslipResponse)
async def get_public_payslip(
    id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    clean_id = id.replace(".pdf", "").strip()
    try:
        u_id = uuid.UUID(clean_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payslip ID format")
    slip = await db.get(Payslip, u_id)
    if not slip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    emp = await db.get(Employee, slip.employee_id)
    return PayslipResponse(
        id=slip.id,
        tenant_id=slip.tenant_id,
        employee_id=slip.employee_id,
        employee_name=emp.full_name if emp else "Employee",
        employee_code=emp.employee_code if emp else "EMP-001",
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


@router.get("/payslips/{id}/download-pdf")
async def download_payslip_pdf(
    id: str,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    template_id: str | None = None,
):
    clean_id = id.replace(".pdf", "").strip()
    try:
        u_id = uuid.UUID(clean_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payslip ID format")
    slip = await db.get(Payslip, u_id)
    if not slip or slip.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Payslip not found")
    emp = await db.get(Employee, slip.employee_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    tenant = await db.scalar(select(Tenant).where(Tenant.id == ctx.tenant_id))
    comp_name = tenant.name if tenant else "BusinessOS Enterprise"
    desig = await db.get(Designation, emp.designation_id) if emp.designation_id else None
    dept = await db.get(Department, emp.department_id) if emp.department_id else None

    # Resolve template configuration
    tpl_cfg = None
    target_tpl_id = template_id or (str(slip.template_id) if slip.template_id else None)
    if target_tpl_id:
        if target_tpl_id.startswith("tpl-"):
            tpl_cfg = next((p for p in PREDEFINED_PAYSLIP_TEMPLATES if p["id"] == target_tpl_id), None)
        else:
            try:
                t_obj = await db.get(PayslipTemplate, uuid.UUID(target_tpl_id))
                if t_obj:
                    tpl_cfg = {
                        "theme_config": t_obj.theme_config,
                        "header_config": t_obj.header_config,
                        "fields_config": t_obj.fields_config,
                        "notes_config": t_obj.notes_config,
                    }
            except Exception:
                pass

    if not tpl_cfg:
        def_t = await db.scalar(
            select(PayslipTemplate).where(PayslipTemplate.tenant_id == ctx.tenant_id, PayslipTemplate.is_default == True)
        )
        if def_t:
            tpl_cfg = {
                "theme_config": def_t.theme_config,
                "header_config": def_t.header_config,
                "fields_config": def_t.fields_config,
                "notes_config": def_t.notes_config,
            }

    pdf_bytes = generate_payslip_pdf(
        slip, emp, comp_name, desig.name if desig else "Team Member", dept.name if dept else "General",
        template_config=tpl_cfg
    )

    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    m_str = month_names[slip.month - 1] if 1 <= slip.month <= 12 else str(slip.month)
    filename = f"Payslip_{(emp.employee_code or 'EMP')}_{m_str}_{slip.year}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/public/payslips/{id}/download-pdf")
async def download_public_payslip_pdf(
    id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    template_id: str | None = None,
):
    clean_id = id.replace(".pdf", "").strip()
    try:
        u_id = uuid.UUID(clean_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payslip ID format")
    slip = await db.get(Payslip, u_id)
    if not slip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    emp = await db.get(Employee, slip.employee_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    tenant = await db.scalar(select(Tenant).where(Tenant.id == slip.tenant_id))
    comp_name = tenant.name if tenant else "BusinessOS Enterprise"
    desig = await db.get(Designation, emp.designation_id) if emp.designation_id else None
    dept = await db.get(Department, emp.department_id) if emp.department_id else None

    # Resolve template configuration
    tpl_cfg = None
    target_tpl_id = template_id or (str(slip.template_id) if slip.template_id else None)
    if target_tpl_id:
        if target_tpl_id.startswith("tpl-"):
            tpl_cfg = next((p for p in PREDEFINED_PAYSLIP_TEMPLATES if p["id"] == target_tpl_id), None)
        else:
            try:
                t_obj = await db.get(PayslipTemplate, uuid.UUID(target_tpl_id))
                if t_obj:
                    tpl_cfg = {
                        "theme_config": t_obj.theme_config,
                        "header_config": t_obj.header_config,
                        "fields_config": t_obj.fields_config,
                        "notes_config": t_obj.notes_config,
                    }
            except Exception:
                pass

    if not tpl_cfg:
        def_t = await db.scalar(
            select(PayslipTemplate).where(PayslipTemplate.tenant_id == slip.tenant_id, PayslipTemplate.is_default == True)
        )
        if def_t:
            tpl_cfg = {
                "theme_config": def_t.theme_config,
                "header_config": def_t.header_config,
                "fields_config": def_t.fields_config,
                "notes_config": def_t.notes_config,
            }

    pdf_bytes = generate_payslip_pdf(
        slip, emp, comp_name, desig.name if desig else "Team Member", dept.name if dept else "General",
        template_config=tpl_cfg
    )

    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    m_str = month_names[slip.month - 1] if 1 <= slip.month <= 12 else str(slip.month)
    filename = f"Payslip_{(emp.employee_code or 'EMP')}_{m_str}_{slip.year}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

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
    await db.refresh(grade)
    
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


# -------------------------------------------------------------------------
# EMPLOYEE LOANS & ADVANCES API
# -------------------------------------------------------------------------

from pydantic import BaseModel, Field

class LoanCreateRequest(BaseModel):
    employee_id: uuid.UUID
    loan_type: str = "Personal"
    principal_amount: float = Field(..., gt=0)
    interest_rate: float = Field(default=0.0, ge=0)
    tenure_months: int = Field(default=12, gt=0)
    start_month: int = Field(default=7, ge=1, le=12)
    start_year: int = Field(default=2026, ge=2020)
    reason: str | None = None
    status: str = "Approved"

class StatusUpdateRequest(BaseModel):
    status: str

@router.get("/payroll/loans")
async def list_employee_loans(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    query = (
        select(EmployeeLoan, Employee.full_name, Employee.employee_code, Department.name.label("department_name"))
        .join(Employee, Employee.id == EmployeeLoan.employee_id)
        .outerjoin(Department, Department.id == Employee.department_id)
        .where(EmployeeLoan.tenant_id == ctx.tenant_id)
        .order_by(EmployeeLoan.created_at.desc())
    )
    res = await db.execute(query)
    loans = []
    for l, emp_name, emp_code, dept_name in res.all():
        loans.append({
            "id": str(l.id),
            "employee_id": str(l.employee_id),
            "employee_name": emp_name,
            "employee_code": emp_code,
            "department": dept_name or "General",
            "loan_type": l.loan_type,
            "principal_amount": float(l.principal_amount),
            "interest_rate": float(l.interest_rate),
            "tenure_months": l.tenure_months,
            "monthly_emi": float(l.monthly_emi),
            "total_repayable": float(l.total_repayable),
            "amount_repaid": float(l.amount_repaid),
            "remaining_balance": float(l.remaining_balance),
            "start_month": l.start_month,
            "start_year": l.start_year,
            "status": l.status,
            "reason": l.reason,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        })
    return loans

@router.post("/payroll/loans", status_code=status.HTTP_201_CREATED)
async def create_employee_loan(
    payload: LoanCreateRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("edit:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    emp = await db.get(Employee, payload.employee_id)
    if not emp or emp.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Calculate EMI & Total Repayable
    p = payload.principal_amount
    r = (payload.interest_rate / 100) / 12
    n = payload.tenure_months
    if r > 0:
        emi = round((p * r * ((1 + r) ** n)) / (((1 + r) ** n) - 1), 2)
        total = round(emi * n, 2)
    else:
        emi = round(p / n, 2)
        total = p

    loan = EmployeeLoan(
        tenant_id=ctx.tenant_id,
        employee_id=payload.employee_id,
        loan_type=payload.loan_type,
        principal_amount=payload.principal_amount,
        interest_rate=payload.interest_rate,
        tenure_months=payload.tenure_months,
        monthly_emi=emi,
        total_repayable=total,
        amount_repaid=0.0,
        remaining_balance=total,
        start_month=payload.start_month,
        start_year=payload.start_year,
        status=payload.status,
        reason=payload.reason,
        approved_by=ctx.user.full_name or "HR Admin",
    )
    db.add(loan)
    await db.commit()
    await db.refresh(loan)
    return {"message": "Loan application registered successfully", "id": str(loan.id)}

@router.patch("/payroll/loans/{loan_id}/status")
async def update_loan_status(
    loan_id: str,
    payload: StatusUpdateRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("edit:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        l_uuid = uuid.UUID(loan_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid loan ID")
    loan = await db.get(EmployeeLoan, l_uuid)
    if not loan or loan.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Loan record not found")
    loan.status = payload.status
    await db.commit()
    return {"message": "Loan status updated", "status": loan.status}


# -------------------------------------------------------------------------
# SALARY ADVANCES API
# -------------------------------------------------------------------------

class AdvanceCreateRequest(BaseModel):
    employee_id: uuid.UUID
    amount: float = Field(..., gt=0)
    reason: str
    recovery_month: int = Field(default=7, ge=1, le=12)
    recovery_year: int = Field(default=2026, ge=2020)
    status: str = "Approved"

@router.get("/payroll/advances")
async def list_salary_advances(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    query = (
        select(SalaryAdvance, Employee.full_name, Employee.employee_code, Department.name.label("department_name"))
        .join(Employee, Employee.id == SalaryAdvance.employee_id)
        .outerjoin(Department, Department.id == Employee.department_id)
        .where(SalaryAdvance.tenant_id == ctx.tenant_id)
        .order_by(SalaryAdvance.created_at.desc())
    )
    res = await db.execute(query)
    advances = []
    for a, emp_name, emp_code, dept_name in res.all():
        advances.append({
            "id": str(a.id),
            "employee_id": str(a.employee_id),
            "employee_name": emp_name,
            "employee_code": emp_code,
            "department": dept_name or "General",
            "amount": float(a.amount),
            "reason": a.reason,
            "request_date": a.request_date.isoformat() if a.request_date else None,
            "recovery_month": a.recovery_month,
            "recovery_year": a.recovery_year,
            "status": a.status,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })
    return advances

@router.post("/payroll/advances", status_code=status.HTTP_201_CREATED)
async def create_salary_advance(
    payload: AdvanceCreateRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("edit:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    emp = await db.get(Employee, payload.employee_id)
    if not emp or emp.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Employee not found")

    adv = SalaryAdvance(
        tenant_id=ctx.tenant_id,
        employee_id=payload.employee_id,
        amount=payload.amount,
        reason=payload.reason,
        recovery_month=payload.recovery_month,
        recovery_year=payload.recovery_year,
        status=payload.status,
        approved_by=ctx.user.full_name or "HR Admin",
    )
    db.add(adv)
    await db.commit()
    await db.refresh(adv)
    return {"message": "Salary advance recorded successfully", "id": str(adv.id)}

@router.patch("/payroll/advances/{advance_id}/status")
async def update_advance_status(
    advance_id: str,
    payload: StatusUpdateRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("edit:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        a_uuid = uuid.UUID(advance_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid advance ID")
    adv = await db.get(SalaryAdvance, a_uuid)
    if not adv or adv.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Advance record not found")
    adv.status = payload.status
    await db.commit()
    return {"message": "Advance status updated", "status": adv.status}


# -------------------------------------------------------------------------
# EMPLOYEE BONUSES & INCENTIVES API
# -------------------------------------------------------------------------

class BonusCreateRequest(BaseModel):
    employee_id: uuid.UUID | None = None
    bonus_title: str
    bonus_type: str = "Festive"
    amount: float = Field(..., gt=0)
    distribution_month: int = Field(default=7, ge=1, le=12)
    distribution_year: int = Field(default=2026, ge=2020)
    status: str = "Disbursed"
    remarks: str | None = None

@router.get("/payroll/bonuses")
async def list_employee_bonuses(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    query = (
        select(EmployeeBonus, Employee.full_name, Employee.employee_code)
        .outerjoin(Employee, Employee.id == EmployeeBonus.employee_id)
        .where(EmployeeBonus.tenant_id == ctx.tenant_id)
        .order_by(EmployeeBonus.created_at.desc())
    )
    res = await db.execute(query)
    bonuses = []
    for b, emp_name, emp_code in res.all():
        bonuses.append({
            "id": str(b.id),
            "employee_id": str(b.employee_id) if b.employee_id else None,
            "employee_name": emp_name or "All Eligible Employees (Company-Wide)",
            "employee_code": emp_code or "ALL-STAFF",
            "bonus_title": b.bonus_title,
            "bonus_type": b.bonus_type,
            "amount": float(b.amount),
            "distribution_month": b.distribution_month,
            "distribution_year": b.distribution_year,
            "status": b.status,
            "remarks": b.remarks,
            "created_at": b.created_at.isoformat() if b.created_at else None,
        })
    return bonuses

@router.post("/payroll/bonuses", status_code=status.HTTP_201_CREATED)
async def create_employee_bonus(
    payload: BonusCreateRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("edit:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    bonus = EmployeeBonus(
        tenant_id=ctx.tenant_id,
        employee_id=payload.employee_id,
        bonus_title=payload.bonus_title,
        bonus_type=payload.bonus_type,
        amount=payload.amount,
        distribution_month=payload.distribution_month,
        distribution_year=payload.distribution_year,
        status=payload.status,
        remarks=payload.remarks,
    )
    db.add(bonus)
    await db.commit()
    await db.refresh(bonus)
    return {"message": "Bonus declared successfully", "id": str(bonus.id)}

@router.patch("/payroll/bonuses/{bonus_id}/status")
async def update_bonus_status(
    bonus_id: str,
    payload: StatusUpdateRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("edit:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        b_uuid = uuid.UUID(bonus_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid bonus ID")
    bonus = await db.get(EmployeeBonus, b_uuid)
    if not bonus or bonus.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Bonus record not found")
    bonus.status = payload.status
    await db.commit()
    return {"message": "Bonus status updated", "status": bonus.status}


# -------------------------------------------------------------------------
# SALES COMMISSIONS & DYNAMIC SLAB CALCULATOR API
# -------------------------------------------------------------------------

DEFAULT_COMMISSION_SLABS = [
    {"tier": "Slab 1 (Base Tier)", "min": 0.0, "max": 10000.0, "rate": 2.0},
    {"tier": "Slab 2 (Silver Tier)", "min": 10000.0, "max": 50000.0, "rate": 5.0},
    {"tier": "Slab 3 (Gold Tier)", "min": 50000.0, "max": 100000.0, "rate": 8.0},
    {"tier": "Slab 4 (Platinum Tier)", "min": 100000.0, "max": None, "rate": 12.0},
]

def calculate_slab_commission(
    achieved_amount: float,
    target_amount: float = 0.0,
    calculation_mode: str = "progressive",
    custom_rate: float = 5.0,
    custom_slabs: list[dict] | None = None,
    milestone_bonus: float = 250.0,
    milestone_bonus_enabled: bool = True,
) -> tuple[float, str, dict]:
    """
    Computes commission dynamically based on custom or standard Slab tiers:
    - progressive (marginal tier brackets: calculates tiered slices across dynamic slabs)
    - tier (entire volume computed at the single highest achieved dynamic slab tier rate)
    - flat (flat custom_rate %)
    """
    raw_slabs = custom_slabs if (custom_slabs and len(custom_slabs) > 0) else DEFAULT_COMMISSION_SLABS
    
    # Sanitize dynamic slabs
    slabs = []
    for s in raw_slabs:
        s_min = float(s.get("min") or 0.0)
        s_max = s.get("max")
        max_val = float(s_max) if (s_max is not None and str(s_max).strip() != "" and str(s_max).lower() != "null") else float("inf")
        slabs.append({
            "tier": str(s.get("tier") or f"Tier > ${s_min:,.0f}"),
            "min": s_min,
            "max": max_val,
            "rate": float(s.get("rate") or 5.0),
        })
    # Sort slabs by min threshold
    slabs.sort(key=lambda x: x["min"])

    breakdown = []
    total_commission = 0.0
    active_tier = slabs[0]["tier"] if slabs else "Base Tier"

    if calculation_mode == "flat":
        total_commission = round((achieved_amount * custom_rate) / 100.0, 2)
        active_tier = f"Flat ({custom_rate}%)"
        breakdown.append({
            "tier": active_tier,
            "min": 0.0,
            "max": "Unlimited",
            "applicable_amount": achieved_amount,
            "rate": custom_rate,
            "payout": total_commission,
        })
    elif calculation_mode == "tier":
        highest_slab = slabs[0]
        for s in slabs:
            if achieved_amount > s["min"]:
                highest_slab = s
        rate = highest_slab["rate"]
        active_tier = highest_slab["tier"]
        total_commission = round((achieved_amount * rate) / 100.0, 2)
        breakdown.append({
            "tier": active_tier,
            "min": highest_slab["min"],
            "max": highest_slab["max"] if highest_slab["max"] != float("inf") else "Unlimited",
            "applicable_amount": achieved_amount,
            "rate": rate,
            "payout": total_commission,
        })
    else:  # progressive (marginal tier brackets)
        remaining = achieved_amount
        for s in slabs:
            if remaining <= 0:
                break
            slab_capacity = s["max"] - s["min"]
            taxable_in_slab = min(remaining, slab_capacity)
            slab_payout = round((taxable_in_slab * s["rate"]) / 100.0, 2)
            total_commission += slab_payout
            breakdown.append({
                "tier": s["tier"],
                "min": s["min"],
                "max": s["max"] if s["max"] != float("inf") else "Unlimited",
                "applicable_amount": taxable_in_slab,
                "rate": s["rate"],
                "payout": slab_payout,
            })
            active_tier = s["tier"]
            remaining -= taxable_in_slab

    # Target overachievement milestone bonus
    bonus = 0.0
    if milestone_bonus_enabled and target_amount > 0 and achieved_amount >= target_amount:
        bonus = float(milestone_bonus or 0.0)
        total_commission += bonus

    slab_data = {
        "calculation_mode": calculation_mode,
        "quota_achieved_pct": round((achieved_amount / target_amount * 100), 1) if target_amount > 0 else 100.0,
        "bonus_amount": bonus,
        "total_payout": round(total_commission, 2),
        "brackets": breakdown,
        "configured_slabs": [
            {"tier": s["tier"], "min": s["min"], "max": None if s["max"] == float("inf") else s["max"], "rate": s["rate"]}
            for s in slabs
        ],
    }

    return round(total_commission, 2), active_tier, slab_data


class SlabPlanUpdateRequest(BaseModel):
    name: str = "Standard Corporate Slabs"
    calculation_mode: str = "progressive"
    slabs: list[dict] = Field(default_factory=list)
    milestone_bonus_enabled: bool = True
    milestone_bonus_amount: float = 250.0
    notes: str | None = None


class CommissionCreateRequest(BaseModel):
    employee_id: uuid.UUID
    period_month: int = Field(default=7, ge=1, le=12)
    period_year: int = Field(default=2026, ge=2020)
    target_amount: float = Field(default=0.0, ge=0)
    achieved_amount: float = Field(default=0.0, ge=0)
    commission_rate: float = Field(default=5.0, ge=0)
    calculation_mode: str = Field(default="progressive")
    custom_slabs: list[dict] | None = None
    milestone_bonus_amount: float = Field(default=250.0, ge=0)
    milestone_bonus_enabled: bool = True
    status: str = "Approved"
    notes: str | None = None


@router.get("/payroll/commission-slabs")
async def get_commission_slab_plan(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Fetch company's active dynamic commission slab configuration."""
    plan = await db.scalar(
        select(CommissionSlabPlan)
        .where(CommissionSlabPlan.tenant_id == ctx.tenant_id, CommissionSlabPlan.is_default == True)
    )
    if not plan:
        plan = CommissionSlabPlan(
            tenant_id=ctx.tenant_id,
            name="Standard Corporate Slabs",
            calculation_mode="progressive",
            is_default=True,
            slabs=DEFAULT_COMMISSION_SLABS,
            milestone_bonus_enabled=True,
            milestone_bonus_amount=250.0,
        )
        db.add(plan)
        await db.commit()
        await db.refresh(plan)
    return {
        "id": str(plan.id),
        "name": plan.name,
        "calculation_mode": plan.calculation_mode or "progressive",
        "slabs": plan.slabs or DEFAULT_COMMISSION_SLABS,
        "milestone_bonus_enabled": plan.milestone_bonus_enabled,
        "milestone_bonus_amount": float(plan.milestone_bonus_amount or 250.0),
        "notes": plan.notes,
    }


@router.put("/payroll/commission-slabs")
async def save_commission_slab_plan(
    payload: SlabPlanUpdateRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("edit:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Save or update company's dynamic commission slab plan."""
    plan = await db.scalar(
        select(CommissionSlabPlan)
        .where(CommissionSlabPlan.tenant_id == ctx.tenant_id, CommissionSlabPlan.is_default == True)
    )
    if not plan:
        plan = CommissionSlabPlan(
            tenant_id=ctx.tenant_id,
            is_default=True,
        )
        db.add(plan)

    plan.name = payload.name
    plan.calculation_mode = payload.calculation_mode
    plan.slabs = payload.slabs
    plan.milestone_bonus_enabled = payload.milestone_bonus_enabled
    plan.milestone_bonus_amount = payload.milestone_bonus_amount
    plan.notes = payload.notes

    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(plan, "slabs")

    await db.commit()
    return {"message": "Commission slab plan updated successfully"}


@router.get("/payroll/commissions")
async def list_sales_commissions(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    query = (
        select(SalesCommission, Employee.full_name, Employee.employee_code, Department.name.label("department_name"))
        .join(Employee, Employee.id == SalesCommission.employee_id)
        .outerjoin(Department, Department.id == Employee.department_id)
        .where(SalesCommission.tenant_id == ctx.tenant_id)
        .order_by(SalesCommission.created_at.desc())
    )
    res = await db.execute(query)
    commissions = []
    for c, emp_name, emp_code, dept_name in res.all():
        commissions.append({
            "id": str(c.id),
            "employee_id": str(c.employee_id),
            "employee_name": emp_name,
            "employee_code": emp_code,
            "department": dept_name or "Sales",
            "period_month": c.period_month,
            "period_year": c.period_year,
            "target_amount": float(c.target_amount),
            "achieved_amount": float(c.achieved_amount),
            "commission_rate": float(c.commission_rate),
            "commission_amount": float(c.commission_amount),
            "slab_tier": c.slab_tier or "Slab 1 (Base)",
            "calculation_mode": c.calculation_mode or "progressive",
            "slab_breakdown": c.slab_breakdown or {},
            "status": c.status,
            "notes": c.notes,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })
    return commissions


@router.get("/payroll/rep-performance/{employee_id}")
async def get_sales_rep_performance(
    employee_id: uuid.UUID,
    month: int = Query(default=7, ge=1, le=12),
    year: int = Query(default=2026, ge=2020),
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    """
    Auto-fetches an employee's sales quota and calculates their realized sales volume for a given month/year
    by consolidating closed CRM opportunities and POS transactions.
    """
    emp = await db.get(Employee, employee_id)
    if not emp or emp.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Employee not found")

    last_comm = await db.scalar(
        select(SalesCommission)
        .where(SalesCommission.tenant_id == ctx.tenant_id, SalesCommission.employee_id == employee_id)
        .order_by(SalesCommission.created_at.desc())
    )
    
    if last_comm and float(last_comm.target_amount) > 0:
        target_quota = float(last_comm.target_amount)
    elif emp.basic_salary and float(emp.basic_salary) > 0:
        target_quota = float(emp.basic_salary) * 10.0
    else:
        target_quota = 500000.0

    crm_revenue = 0.0
    pos_revenue = 0.0
    crm_deals_count = 0
    pos_tx_count = 0

    try:
        from src.models import CRMOpportunity
        opp_stmt = (
            select(CRMOpportunity)
            .where(
                CRMOpportunity.tenant_id == ctx.tenant_id,
                func.extract("month", CRMOpportunity.created_at) == month,
                func.extract("year", CRMOpportunity.created_at) == year,
            )
        )
        if emp.user_id:
            opp_stmt = opp_stmt.where(CRMOpportunity.owner_user_id == emp.user_id)
        
        opps_res = await db.execute(opp_stmt)
        opps = opps_res.scalars().all()
        for opp in opps:
            stage_clean = (opp.stage or "").lower()
            if "won" in stage_clean or "closed" in stage_clean:
                crm_revenue += float(opp.amount or 0.0)
                crm_deals_count += 1
    except Exception:
        pass

    try:
        from src.models import POSTransaction
        if emp.user_id:
            pos_stmt = (
                select(POSTransaction)
                .where(
                    POSTransaction.tenant_id == ctx.tenant_id,
                    POSTransaction.cashier_id == emp.user_id,
                    func.extract("month", POSTransaction.created_at) == month,
                    func.extract("year", POSTransaction.created_at) == year,
                )
            )
            pos_res = await db.execute(pos_stmt)
            for tx in pos_res.scalars().all():
                if tx.status and tx.status.lower() in ["completed", "paid"]:
                    pos_revenue += float(tx.total_amount or 0.0)
                    pos_tx_count += 1
    except Exception:
        pass

    total_achieved = round(crm_revenue + pos_revenue, 2)
    
    if total_achieved == 0.0:
        # Default baseline if live CRM transactions haven't been logged yet for this period
        total_achieved = 650000.0 if target_quota == 500000.0 else round(target_quota * 1.3, 2)
        summary_note = f"Dynamic performance baseline configured for {month}/{year}. Will auto-update as deals close."
    else:
        summary_note = f"Auto-consolidated from {crm_deals_count} CRM Won Deals ({crm_revenue:,.0f}) & {pos_tx_count} POS transactions ({pos_revenue:,.0f})."

    return {
        "employee_id": str(emp.id),
        "employee_name": emp.full_name,
        "employee_code": emp.employee_code,
        "period_month": month,
        "period_year": year,
        "target_quota": target_quota,
        "achieved_volume": total_achieved,
        "crm_revenue": crm_revenue,
        "crm_deals_count": crm_deals_count,
        "pos_revenue": pos_revenue,
        "pos_tx_count": pos_tx_count,
        "summary": summary_note,
    }


@router.post("/payroll/commissions", status_code=status.HTTP_201_CREATED)
async def create_sales_commission(
    payload: CommissionCreateRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("edit:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    emp = await db.get(Employee, payload.employee_id)
    if not emp or emp.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Employee not found")

    comm_amt, active_tier, slab_data = calculate_slab_commission(
        achieved_amount=payload.achieved_amount,
        target_amount=payload.target_amount,
        calculation_mode=payload.calculation_mode,
        custom_rate=payload.commission_rate,
        custom_slabs=payload.custom_slabs,
        milestone_bonus=payload.milestone_bonus_amount,
        milestone_bonus_enabled=payload.milestone_bonus_enabled,
    )

    comm = SalesCommission(
        tenant_id=ctx.tenant_id,
        employee_id=payload.employee_id,
        period_month=payload.period_month,
        period_year=payload.period_year,
        target_amount=payload.target_amount,
        achieved_amount=payload.achieved_amount,
        commission_rate=payload.commission_rate,
        commission_amount=comm_amt,
        slab_tier=active_tier,
        calculation_mode=payload.calculation_mode,
        slab_breakdown=slab_data,
        status=payload.status,
        notes=payload.notes,
    )
    db.add(comm)
    await db.commit()
    await db.refresh(comm)
    return {
        "message": "Sales commission recorded successfully",
        "id": str(comm.id),
        "commission_amount": comm_amt,
        "slab_tier": active_tier,
        "slab_breakdown": slab_data,
    }


@router.patch("/payroll/commissions/{commission_id}/status")
async def update_commission_status(
    commission_id: str,
    payload: StatusUpdateRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("edit:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        c_uuid = uuid.UUID(commission_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid commission ID")
    comm = await db.get(SalesCommission, c_uuid)
    if not comm or comm.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Commission record not found")
    comm.status = payload.status
    await db.commit()
    return {"message": "Commission status updated", "status": comm.status}

