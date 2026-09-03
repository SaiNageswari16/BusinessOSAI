"""
HRMS — Recruitment & Onboarding Endpoints (Job Openings, Applicants, Interview overlap checker, Offer Letters, Onboarding)
"""
import uuid
import io
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from datetime import datetime, date, timedelta
from typing import Annotated
from pathlib import Path

import pypdf
try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    HAS_REPORTLAB = True
except ImportError:
    HAS_REPORTLAB = False

from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile, status
from fastapi.responses import Response, HTMLResponse
from pydantic import BaseModel
from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUserContext, require_permission
from src.config import get_settings
from src.database.init_db import write_audit_log
from src.database.session import get_db
from src.utils.notifications import add_system_notification
from src.models import (
    JobOpening,
    Applicant,
    Interview,
    OfferLetter,
    OnboardingRecord,
    Employee,
    EmployeeDocument,
    Tenant,
)
from src.schemas.erp import (
    JobOpeningCreate,
    JobOpeningUpdate,
    JobOpeningResponse,
    ApplicantCreate,
    ApplicantUpdate,
    ApplicantResponse,
    InterviewCreate,
    InterviewUpdate,
    InterviewResponse,
    OfferLetterCreate,
    OfferLetterUpdate,
    OfferLetterResponse,
    OnboardingCreate,
    OnboardingUpdate,
    OnboardingResponse,
)
from src.utils.pagination import PaginatedResponse, paginate

router = APIRouter(prefix="/hrms/recruitment", tags=["HRMS - Recruitment"])
class _SettingsProxy:
    def __getattr__(self, name):
        return getattr(get_settings(), name)

settings = _SettingsProxy()

# ─── PDF Offer Letter Generation Engine ───────────────────────────────────────

def _escape_pdf_text(t: str) -> str:
    return t.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')

def _generate_pure_python_offer_pdf(offer: OfferLetter, company_name: str, tenant: Tenant | None = None) -> bytes:
    """Zero-dependency pure Python PDF 1.4 generator for official Offer Letters."""
    ctc = float(offer.ctc or 0)
    b_m, b_a = (ctc * 0.5) / 12, ctc * 0.5
    h_m, h_a = (ctc * 0.2) / 12, ctc * 0.2
    s_m, s_a = (ctc * 0.2) / 12, ctc * 0.2
    p_m, p_a = (ctc * 0.1) / 12, ctc * 0.1
    tot_m, tot_a = ctc / 12, ctc

    offer_date_str = str(offer.offer_date or date.today())
    expiry_date_str = str(offer.expiry_date or "7 Days from Issuance")
    joining_date_str = str(offer.joining_date or "Mutually Agreed")
    signer_name = offer.signer_name or "Authorized HR Signatory"
    candidate_name = offer.candidate or "Candidate"
    role_name = offer.role or "Team Member"
    ref_id = f"OFR-{offer.id.hex[:8].upper()}" if hasattr(offer.id, 'hex') else f"OFR-{str(offer.id)[:8].upper()}"

    lines = [
        ('F2', 18, 50, 780, company_name),
        ('F2', 8.5, 50, 762, 'TALENT ACQUISITION & PEOPLE OPERATIONS - FORMAL APPOINTMENT LETTER'),
        ('LINE', 0, 50, 752, 545, 752),
        ('F2', 9.5, 50, 730, f'Candidate: {candidate_name}'),
        ('F1', 9.5, 50, 715, f'Position: {role_name}'),
        ('F1', 9.5, 50, 700, f'Target Joining Date: {joining_date_str}'),
        ('F2', 9.5, 360, 730, f'Date: {offer_date_str}'),
        ('F1', 9.5, 360, 715, f'Valid Until: {expiry_date_str}'),
        ('F1', 9.5, 360, 700, f'Ref No: {ref_id}'),
        ('LINE', 0, 50, 688, 545, 688),
        ('F2', 11, 50, 668, f'Subject: Formal Offer of Employment - {role_name}'),
        ('F1', 9.5, 50, 648, f'Dear {candidate_name},'),
        ('F1', 9.5, 50, 632, f'On behalf of {company_name}, we are pleased to offer you the position of {role_name}.'),
        ('F1', 9.5, 50, 616, 'Our leadership team believes your dedication and expertise will be a vital asset to our growth.'),
        ('F2', 10.5, 50, 585, 'Annexure A: Annual Compensation Breakdown (INR)'),
        ('LINE', 0, 50, 575, 545, 575),
        ('F2', 9, 55, 560, 'Component'),
        ('F2', 9, 260, 560, 'Monthly (INR)'),
        ('F2', 9, 390, 560, 'Annual (INR)'),
        ('F2', 9, 490, 560, 'Split'),
        ('LINE', 0, 50, 552, 545, 552),
        ('F1', 9, 55, 538, 'Basic Salary (50%)'),
        ('F1', 9, 260, 538, f'INR {b_m:,.2f}'),
        ('F1', 9, 390, 538, f'INR {b_a:,.2f}'),
        ('F1', 9, 490, 538, '50%'),
        ('F1', 9, 55, 522, 'House Rent Allowance - HRA (20%)'),
        ('F1', 9, 260, 522, f'INR {h_m:,.2f}'),
        ('F1', 9, 390, 522, f'INR {h_a:,.2f}'),
        ('F1', 9, 490, 522, '20%'),
        ('F1', 9, 55, 506, 'Special / Personal Allowance (20%)'),
        ('F1', 9, 260, 506, f'INR {s_m:,.2f}'),
        ('F1', 9, 390, 506, f'INR {s_a:,.2f}'),
        ('F1', 9, 490, 506, '20%'),
        ('F1', 9, 55, 490, 'Employer Provident Fund (10%)'),
        ('F1', 9, 260, 490, f'INR {p_m:,.2f}'),
        ('F1', 9, 390, 490, f'INR {p_a:,.2f}'),
        ('F1', 9, 490, 490, '10%'),
        ('LINE', 0, 50, 480, 545, 480),
        ('F2', 9.5, 55, 466, 'Total Gross Cost to Company (Annual CTC)'),
        ('F2', 9.5, 260, 466, f'INR {tot_m:,.2f}'),
        ('F2', 9.5, 390, 466, f'INR {tot_a:,.2f}'),
        ('F2', 9.5, 490, 466, '100%'),
        ('LINE', 0, 50, 456, 545, 456),
        ('F2', 10, 50, 430, 'Key Terms & Conditions:'),
        ('F1', 8.5, 50, 414, '1. Probation: You will be on probation for 3 months from the date of joining.'),
        ('F1', 8.5, 50, 400, '2. Notice Period: 30 days during probation, and 60 days post-confirmation in writing.'),
        ('F1', 8.5, 50, 386, '3. Confidentiality: You shall maintain complete confidentiality of proprietary information.'),
        ('F1', 8.5, 50, 372, '4. Intellectual Property: Any invention or work created during employment belongs to the Company.'),
        ('LINE', 0, 50, 340, 545, 340),
        ('F2', 9, 50, 320, f'For {company_name}:'),
        ('F1', 9, 50, 280, f'{signer_name}'),
        ('F1', 8, 50, 268, 'Head of Talent & People Operations'),
        ('F1', 8, 50, 256, '[Digitally Authorized Signature]'),
        ('F2', 9, 340, 320, 'Accepted & Acknowledged:'),
        ('LINE', 0, 340, 280, 520, 280),
        ('F1', 8, 340, 268, f'{candidate_name} (Signature)'),
        ('F1', 8, 340, 256, 'Date: ________________________'),
        ('F1', 7.5, 120, 50, f'Official Appointment Record - Generated securely via {company_name} Compliance Vault'),
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


def _generate_reportlab_offer_pdf(offer: OfferLetter, company_name: str, tenant: Tenant | None = None) -> bytes:
    """Generates an official, high-resolution A4 PDF Offer Letter with salary annexure, legal clauses & signing block via ReportLab."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )
    styles = getSampleStyleSheet()

    header_title = ParagraphStyle('H1', fontName='Helvetica-Bold', fontSize=16, leading=20, textColor=colors.HexColor('#0f172a'))
    header_sub = ParagraphStyle('HSub', fontName='Helvetica-Bold', fontSize=8, leading=11, textColor=colors.HexColor('#64748b'))
    meta_label = ParagraphStyle('MetaL', fontName='Helvetica-Bold', fontSize=8.5, leading=12, textColor=colors.HexColor('#475569'))
    meta_val = ParagraphStyle('MetaV', fontName='Helvetica', fontSize=8.5, leading=12, textColor=colors.HexColor('#0f172a'))
    body_p = ParagraphStyle('BodyP', fontName='Helvetica', fontSize=9, leading=14, textColor=colors.HexColor('#334155'))
    clause_title = ParagraphStyle('CTitle', fontName='Helvetica-Bold', fontSize=9.5, leading=13, textColor=colors.HexColor('#0f172a'))
    clause_p = ParagraphStyle('CP', fontName='Helvetica', fontSize=8.5, leading=12, textColor=colors.HexColor('#475569'))

    story = []

    # Company Header Banner
    story.append(Paragraph(company_name, header_title))
    story.append(Paragraph('TALENT ACQUISITION &amp; PEOPLE OPERATIONS • OFFICIAL APPOINTMENT', header_sub))
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width='100%', thickness=1.5, color=colors.HexColor('#1e1b4b'), spaceAfter=12))

    # Reference Metadata Table
    ref_id = f"OFR-{offer.id.hex[:8].upper()}" if hasattr(offer.id, 'hex') else f"OFR-{str(offer.id)[:8].upper()}"
    meta_data = [
        [Paragraph('<b>To:</b>', meta_label), Paragraph(offer.candidate or 'Candidate', meta_val),
         Paragraph('<b>Offer Date:</b>', meta_label), Paragraph(str(offer.offer_date or date.today()), meta_val)],
        [Paragraph('<b>Email:</b>', meta_label), Paragraph(offer.candidate_email or 'N/A', meta_val),
         Paragraph('<b>Valid Until:</b>', meta_label), Paragraph(str(offer.expiry_date or '7 Days'), meta_val)],
        [Paragraph('<b>Role:</b>', meta_label), Paragraph(offer.role or 'Team Member', meta_val),
         Paragraph('<b>Ref No:</b>', meta_label), Paragraph(ref_id, meta_val)],
    ]
    meta_table = Table(meta_data, colWidths=[50, 210, 70, 190])
    meta_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 14))

    # Subject & Formal Opening
    story.append(Paragraph(f'<b>Subject: Formal Employment Offer — {offer.role}</b>', clause_title))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        f'Dear <b>{offer.candidate}</b>,<br/><br/>'
        f'On behalf of <b>{company_name}</b>, we are very pleased to extend this formal offer of employment for the position of <b>{offer.role}</b>. '
        f'Following our comprehensive evaluations, our leadership team is confident that your talent, dedication, and expertise will make a significant impact on our organization.<br/><br/>'
        f'Target Date of Joining: <b>{offer.joining_date or "Mutually Agreed"}</b>.',
        body_p
    ))
    story.append(Spacer(1, 10))

    # Compensation Breakdown (Annexure A)
    ctc = float(offer.ctc or 0)
    b_m, b_a = (ctc * 0.5) / 12, ctc * 0.5
    h_m, h_a = (ctc * 0.2) / 12, ctc * 0.2
    s_m, s_a = (ctc * 0.2) / 12, ctc * 0.2
    p_m, p_a = (ctc * 0.1) / 12, ctc * 0.1
    tot_m, tot_a = ctc / 12, ctc

    story.append(Paragraph('<b>Annexure A: Annual Compensation Breakdown</b>', clause_title))
    story.append(Spacer(1, 4))
    sal_data = [
        ['Component', 'Monthly (INR)', 'Annual (INR)', 'Split %'],
        ['Basic Salary', f'{b_m:,.2f}', f'{b_a:,.2f}', '50%'],
        ['House Rent Allowance (HRA)', f'{h_m:,.2f}', f'{h_a:,.2f}', '20%'],
        ['Special / Personal Allowance', f'{s_m:,.2f}', f'{s_a:,.2f}', '20%'],
        ['Provident Fund (Employer PF)', f'{p_m:,.2f}', f'{p_a:,.2f}', '10%'],
        ['Total Gross Cost to Company (CTC)', f'{tot_m:,.2f}', f'{tot_a:,.2f}', '100%'],
    ]
    sal_table = Table(sal_data, colWidths=[200, 110, 130, 80])
    sal_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('BACKGROUND', (0, 1), (-1, -2), colors.HexColor('#f8fafc')),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f1f5f9')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(sal_table)
    story.append(Spacer(1, 10))

    # Terms & Conditions
    story.append(Paragraph('<b>Terms &amp; Conditions</b>', clause_title))
    story.append(Spacer(1, 4))
    if offer.custom_template:
        for line in offer.custom_template.split('\n'):
            clean_l = line.strip()
            if clean_l:
                story.append(Paragraph(clean_l, clause_p))
    else:
        story.append(Paragraph('1. <b>Probation &amp; Confirmation:</b> You will serve a probation period of three (3) months from your date of joining. Confirmation will be subject to satisfactory performance.', clause_p))
        story.append(Paragraph('2. <b>Notice Period:</b> Either party may terminate with 30 days notice during probation, and 60 days notice post-confirmation.', clause_p))
        story.append(Paragraph('3. <b>Confidentiality &amp; IP:</b> You agree to protect all company proprietary information and assign intellectual property created during employment to the Company.', clause_p))
    story.append(Spacer(1, 16))

    # Signatures Block
    signer = offer.signer_name or 'Authorized Signatory'
    sig_data = [
        [Paragraph(f'<b>For {company_name}:</b>', meta_label), Paragraph('<b>Accepted &amp; Acknowledged:</b>', meta_label)],
        [Spacer(1, 16), Spacer(1, 16)],
        [Paragraph(f'<b>{signer}</b><br/>Head of Talent &amp; People Operations<br/><i>Digitally Authorized Document</i>', meta_val),
         Paragraph(f'<b>{offer.candidate}</b><br/>Signature &amp; Date<br/>Date: ________________________', meta_val)]
    ]
    sig_table = Table(sig_data, colWidths=[260, 260])
    sig_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(sig_table)

    doc.build(story)
    return buffer.getvalue()


def generate_offer_letter_pdf(offer: OfferLetter, company_name: str, tenant: Tenant | None = None) -> bytes:
    """Generates an official Offer Letter PDF using ReportLab when available, with resilient pure-Python fallback."""
    if HAS_REPORTLAB:
        try:
            return _generate_reportlab_offer_pdf(offer, company_name, tenant)
        except Exception as err:
            print(f"[REPORTLAB RENDERING NOTICE, USING PURE-PYTHON ENGINE]: {err}")
    return _generate_pure_python_offer_pdf(offer, company_name, tenant)


# ─── SMTP Live Email Dispatch Utility ───────────────────────────────────────────

async def send_recruitment_email(
    to_email: str,
    subject: str,
    body_text: str,
    html_body: str | None = None,
    attachment_bytes: bytes | None = None,
    attachment_filename: str | None = None,
    tenant_id: uuid.UUID | str | None = None,
    company_id: uuid.UUID | str | None = None,
    db: AsyncSession | None = None,
) -> bool:
    from src.utils.email import send_email as unified_send_email
    return await unified_send_email(
        subject=subject,
        recipients=[to_email],
        html=html_body,
        text=body_text,
        attachment_bytes=attachment_bytes,
        attachment_filename=attachment_filename,
        tenant_id=tenant_id,
        company_id=company_id,
        db=db,
    )


# ─── Helper Functions & Parsers ──────────────────────────────────────────────────

def calculate_match_score(resume: str | None, criteria: str) -> int:
    if not resume or not criteria:
        return 50
    resume_lower = resume.lower()
    keywords = [k.strip().lower() for k in criteria.split(",") if k.strip()]
    if not keywords:
        return 50
    matches = sum(1 for kw in keywords if kw in resume_lower)
    score = int((matches / len(keywords)) * 50) + 40 + (len(resume) % 10)
    return min(score, 100)


def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    filename_lower = filename.lower()
    if filename_lower.endswith(".txt") or filename_lower.endswith(".md"):
        return file_bytes.decode("utf-8", errors="ignore")
    
    if filename_lower.endswith(".pdf"):
        try:
            pdf_file = io.BytesIO(file_bytes)
            reader = pypdf.PdfReader(pdf_file)
            text = ""
            for page in reader.pages:
                text += page.extract_text() or ""
            return text
        except Exception as e:
            print(f"[PDF EXCLUSION ERROR] Failed to parse: {e}")
            return ""
    return ""


async def ensure_seeded_data(db: AsyncSession, tenant_id: uuid.UUID):
    """Seed recruitment data for the tenant if no job openings exist."""
    job_count = await db.scalar(select(func.count()).select_from(JobOpening).where(JobOpening.tenant_id == tenant_id))
    if job_count > 0:
        return

    # Seed Jobs
    jobs_to_seed = [
        JobOpening(
            tenant_id=tenant_id,
            title="Senior Backend Engineer",
            department="Engineering",
            location="Remote",
            type="Full-Time",
            experience="4-6 years",
            openings=2,
            applicants_count=2,
            posted_date=date.today() - timedelta(days=30),
            status="Open",
            threshold_score=75,
            portals=["Careers Page", "LinkedIn", "Naukri.com", "Zoho Careers"],
            criteria="Python, FastAPI, PostgreSQL, AWS, Docker, Microservices",
            description="We are looking for a Senior Backend Engineer to build scalable APIs and design microservices in a Python/FastAPI backend framework. You will work on optimizing database queries in PostgreSQL, deploying serverless workloads on AWS, and setting up CI/CD workflows."
        ),
        JobOpening(
            tenant_id=tenant_id,
            title="Sales Account Executive",
            department="Sales",
            location="San Francisco, CA",
            type="Full-Time",
            experience="2-4 years",
            openings=3,
            applicants_count=2,
            posted_date=date.today() - timedelta(days=25),
            status="Open",
            threshold_score=70,
            portals=["Careers Page", "LinkedIn", "Indeed"],
            criteria="SaaS Sales, CRM, Lead Generation, Presentation, Communication",
            description="Identify and close sales opportunities in mid-market accounts. Deliver exceptional product demonstrations, handle pricing discussions, and coordinate closely with customer success to drive user adoption."
        ),
        JobOpening(
            tenant_id=tenant_id,
            title="UX / Product Designer",
            department="Engineering",
            location="Remote",
            type="Full-Time",
            experience="3-5 years",
            openings=1,
            applicants_count=1,
            posted_date=date.today() - timedelta(days=15),
            status="Open",
            threshold_score=80,
            portals=["Careers Page", "Glassdoor"],
            criteria="Figma, User Research, Wireframes, Prototyping, Design System",
            description="Design intuitive user flows and pixel-perfect UI screens for our core platform modules. Conduct user interviews, create low and high fidelity wireframes in Figma, and manage our brand design system."
        )
    ]
    
    for j in jobs_to_seed:
        db.add(j)
    await db.flush()

    # Seed Applicants
    app1 = Applicant(
        tenant_id=tenant_id,
        name="Nikhil Mehta",
        email="nikhil@mail.com",
        job_id=jobs_to_seed[0].id,
        job_title=jobs_to_seed[0].title,
        applied_date=date.today() - timedelta(days=28),
        experience="5 years",
        rating=4,
        stage="Interview",
        source="LinkedIn",
        match_score=85,
        resume_text="Experienced backend engineer with 5 years building REST APIs using Python, FastAPI, and Flask. Strong knowledge of PostgreSQL databases, query optimizations, Docker containers, and deploying microservices on AWS EC2/ECS."
    )
    app2 = Applicant(
        tenant_id=tenant_id,
        name="Claire Dubois",
        email="claire@mail.com",
        job_id=jobs_to_seed[0].id,
        job_title=jobs_to_seed[0].title,
        applied_date=date.today() - timedelta(days=27),
        experience="4 years",
        rating=3,
        stage="Screening",
        source="Naukri.com",
        match_score=72,
        resume_text="4 years of software engineering experience. Experienced with Django and MySQL. Familiar with git, unit testing, and Docker. Looking to transition into FastAPI and AWS architecture."
    )
    app3 = Applicant(
        tenant_id=tenant_id,
        name="Tom Wilson",
        email="tom@mail.com",
        job_id=jobs_to_seed[1].id,
        job_title=jobs_to_seed[1].title,
        applied_date=date.today() - timedelta(days=22),
        experience="3 years",
        rating=5,
        stage="Offer",
        source="Indeed",
        match_score=92,
        resume_text="Account Executive with 3 years SaaS sales experience. Exceeded quota by 120% in consecutive quarters. Expert in lead generation, HubSpot CRM, sales calls, online product demos, and contract negotiations."
    )
    app4 = Applicant(
        tenant_id=tenant_id,
        name="Jason Bourne",
        email="jason@mail.com",
        job_id=jobs_to_seed[1].id,
        job_title=jobs_to_seed[1].title,
        applied_date=date.today() - timedelta(days=20),
        experience="2 years",
        rating=3,
        stage="Applied",
        source="LinkedIn",
        match_score=68,
        resume_text="Sales associate focused on enterprise communications. Experience in outbound calling, lead qualification, Salesforce entries, and client relations."
    )
    app5 = Applicant(
        tenant_id=tenant_id,
        name="Anjali Singh",
        email="anjali@mail.com",
        job_id=jobs_to_seed[2].id,
        job_title=jobs_to_seed[2].title,
        applied_date=date.today() - timedelta(days=12),
        experience="4 years",
        rating=5,
        stage="Hired",
        source="Careers Page",
        match_score=88,
        resume_text="Product designer with 4 years creating responsive websites and mobile interfaces. Figma power user. Deep understanding of design systems, responsive typography, user testing, wireframing, and interactive developer handoffs."
    )
    
    db.add_all([app1, app2, app3, app4, app5])
    await db.flush()

    # Seed Interview
    int1 = Interview(
        tenant_id=tenant_id,
        applicant_id=app1.id,
        candidate=app1.name,
        job_title=app1.job_title,
        interviewer_name="Alex Rivera",
        date=(date.today() + timedelta(days=2)).isoformat(),
        time="10:00",
        duration=60,
        type="Technical",
        mode="Video Call",
        meeting_link="https://meet.google.com/abc-defg-hij",
        status="Scheduled"
    )
    db.add(int1)

    # Seed Offer
    ofr1 = OfferLetter(
        tenant_id=tenant_id,
        applicant_id=app3.id,
        candidate=app3.name,
        role=app3.job_title,
        ctc=85000.0,
        offer_date=date.today() - timedelta(days=2),
        expiry_date=date.today() + timedelta(days=5),
        joining_date=date.today() + timedelta(days=20),
        signer_name="Priya Sharma",
        status="Awaiting Acceptance",
        email_sent=True
    )
    db.add(ofr1)

    # Seed Onboarding
    onb1 = OnboardingRecord(
        tenant_id=tenant_id,
        applicant_id=app5.id,
        new_hire=app5.name,
        role=app5.job_title,
        start_date=date.today() + timedelta(days=10),
        progress=67,
        tasks_json=[
            {"task": "Email & System Access Created", "assignedTo": "IT", "status": "Done"},
            {"task": "Offer Letter Signed", "assignedTo": "HR", "status": "Done"},
            {"task": "Background Verification", "assignedTo": "HR", "status": "Done"},
            {"task": "Workstation Setup", "assignedTo": "IT", "status": "In Progress"},
            {"task": "Department Orientation", "assignedTo": "Manager", "status": "Pending"},
            {"task": "Policy Training", "assignedTo": "HR", "status": "Pending"}
        ]
    )
    db.add(onb1)
    await db.commit()


# ─── Public Job Boards RSS/XML Crawler Feed ────────────────────────────────────

@router.get("/jobs/feed")
async def jobs_xml_feed(
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Provides active open jobs structured in XML formats for LinkedIn, Indeed, and Naukri crawlers."""
    stmt = select(JobOpening).where(JobOpening.status == "Open")
    result = await db.execute(stmt)
    jobs = result.scalars().all()

    xml_content = '<?xml version="1.0" encoding="UTF-8" ?>\n'
    xml_content += '<source>\n'
    xml_content += '  <publisher>BusinessOS AI Recruitment Feed</publisher>\n'
    xml_content += '  <publisherurl>http://localhost:8080</publisherurl>\n'
    
    for job in jobs:
        xml_content += '  <job>\n'
        xml_content += f'    <title><![CDATA[{job.title}]]></title>\n'
        xml_content += f'    <date><![CDATA[{job.posted_date}]]></date>\n'
        xml_content += f'    <referencenumber><![CDATA[{job.id}]]></referencenumber>\n'
        xml_content += f'    <description><![CDATA[{job.description}]]></description>\n'
        xml_content += f'    <department><![CDATA[{job.department}]]></department>\n'
        xml_content += f'    <location><![CDATA[{job.location}]]></location>\n'
        xml_content += f'    <jobtype><![CDATA[{job.type}]]></jobtype>\n'
        xml_content += f'    <experience><![CDATA[{job.experience}]]></experience>\n'
        xml_content += f'    <criteria><![CDATA[{job.criteria}]]></criteria>\n'
        xml_content += '  </job>\n'
        
    xml_content += '</source>\n'
    return Response(content=xml_content, media_type="application/xml")


# ─── Real File Upload Parser Endpoint ───────────────────────────────────────────

@router.post("/parse-file")
async def parse_uploaded_file(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    file: UploadFile = File(...)
):
    """Parses text pages out of a PDF or TXT resume/JD and returns classifications."""
    file_bytes = await file.read()
    extracted_text = extract_text_from_file(file_bytes, file.filename)
    
    if not extracted_text:
        raise HTTPException(status_code=400, detail="Failed to extract text from file format.")

    # Apply analysis heuristics
    text_lower = extracted_text.lower()
    suggested_title = "Systems Architect"
    suggested_department = "Engineering"
    suggested_criteria = "AWS, Python, Kubernetes"

    if "react" in text_lower or "typescript" in text_lower or "frontend" in text_lower:
        suggested_title = "Senior Frontend Engineer"
        suggested_criteria = "React, TypeScript, Tailwind CSS, Figma"
    elif "data" in text_lower or "ml" in text_lower or "pandas" in text_lower:
        suggested_title = "Senior Data Scientist"
        suggested_criteria = "Python, SQL, Machine Learning, Pandas, PyTorch"
    elif "sales" in text_lower or "account" in text_lower or "b2b" in text_lower:
        suggested_title = "Sales Account Executive"
        suggested_department = "Sales"
        suggested_criteria = "SaaS Sales, CRM, Salesforce, Communication"
    elif "hr" in text_lower or "recruit" in text_lower:
        suggested_title = "HR Generalist"
        suggested_department = "HR"
        suggested_criteria = "Recruitment, Labor Laws, Employee Relations"

    return {
        "text": extracted_text[:10000],  # Truncate raw response length
        "suggested_title": suggested_title,
        "suggested_department": suggested_department,
        "suggested_criteria": suggested_criteria
    }


# ─── Job Openings ─────────────────────────────────────────────────────────────

@router.get("/jobs", response_model=PaginatedResponse[JobOpeningResponse])
async def list_jobs(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str | None = None,
):
    query = select(JobOpening).where(JobOpening.tenant_id == ctx.tenant_id)
    if status_filter:
        query = query.where(JobOpening.status.ilike(status_filter))
    if search:
        query = query.where(
            JobOpening.title.ilike(f"%{search}%")
            | JobOpening.department.ilike(f"%{search}%")
            | JobOpening.criteria.ilike(f"%{search}%")
        )

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(JobOpening.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/jobs", response_model=JobOpeningResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    payload: JobOpeningCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    new_job = JobOpening(
        tenant_id=ctx.tenant_id,
        title=payload.title,
        department=payload.department,
        location=payload.location,
        type=payload.type,
        experience=payload.experience,
        openings=payload.openings,
        description=payload.description,
        threshold_score=payload.threshold_score,
        portals=payload.portals,
        criteria=payload.criteria,
    )
    db.add(new_job)
    await db.flush()

    await add_system_notification(
        db, 
        ctx.tenant_id, 
        f"New Job Opening: {new_job.title}", 
        f"Job Opening '{new_job.title}' ({new_job.department}) with {new_job.openings} positions was created by {ctx.user.full_name}", 
        "hrms"
    )
    await db.commit()
    await db.refresh(new_job)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="hrms_recruitment",
        action="create_job_opening",
        entity_type="JobOpening",
        entity_id=new_job.id,
        new_values=payload.model_dump(mode="json"),
    )
    await db.commit()
    return new_job


class GenerateJdRequest(BaseModel):
    prompt: str


class GenerateJdResponse(BaseModel):
    title: str
    department: str
    criteria: str
    description: str
    threshold_score: int


def generate_fallback_jd(prompt: str) -> dict:
    prompt_lower = prompt.lower()
    if "react" in prompt_lower or "frontend" in prompt_lower or "web" in prompt_lower:
        title = "Senior Frontend Engineer (React)"
        department = "Engineering"
        criteria = "React, TypeScript, Tailwind CSS, Frontend Architecture, Redux"
        description = (
            "# Job Profile: Senior Frontend Engineer (React)\n"
            "We are seeking an outstanding Senior Frontend Engineer to design, architect, and implement high-performance, "
            "visually stunning, and responsive user interfaces for our enterprise suite.\n\n"
            "## Key Responsibilities\n"
            "- Design and construct state-of-the-art React components utilizing TypeScript and modern design systems.\n"
            "- Collaborate with UI/UX designers to translate Figma visual structures into pixel-perfect modular systems.\n"
            "- Optimize frontend bundles (via Vite/Webpack) and manage complex global states (Redux/Context API).\n"
            "- Write comprehensive unit and integration tests with Jest, Vitest, and Playwright.\n\n"
            "## Requirements\n"
            "- 4+ years of professional web application development experience in JavaScript/TypeScript and modern frameworks.\n"
            "- Strong proficiency in CSS layout models (Flexbox, Grid), CSS-in-JS, Tailwind CSS, or Glassmorphism design system paradigms.\n"
            "- Expert knowledge of React core mechanics, hooks lifecycle, render loops, and performance profiling tools.\n"
            "- Outstanding communication skills, ability to lead visual layouts, and passion for pixel-perfect detail.\n\n"
            "## Evaluation Criteria\n"
            "- Technical Coding Review Test: >= 80%\n"
            "- Client-Side System Design: Pass\n"
            "- Experience & Portfolio Alignment: >= 75%"
        )
    elif "sales" in prompt_lower or "marketing" in prompt_lower or "growth" in prompt_lower:
        title = "Brand Marketing & Lead Specialist"
        department = "Marketing"
        criteria = "SEO, Google Analytics, Copywriting, Marketing Campaigns, PPC"
        description = (
            "# Job Profile: Brand Marketing & Lead Specialist\n"
            "We are looking for an ambitious, data-driven Brand Marketing Specialist to execute high-impact multi-channel "
            "marketing campaigns and drive brand visibility across channels.\n\n"
            "## Key Responsibilities\n"
            "- Strategize and execute digital acquisition campaigns across Google Ads, LinkedIn, and social media channels.\n"
            "- Produce copywriting drafts for landing pages, ad creatives, and customer email newsletters.\n"
            "- Monitor conversion rates, bounce rates, and traffic flows using Google Analytics and tag managers.\n"
            "- Track performance analytics dashboards and deliver monthly reports on customer acquisition costs (CAC) to directors.\n\n"
            "## Requirements\n"
            "- 2+ years of professional digital marketing, brand specialist, or media buying experience.\n"
            "- Proficient in copywriting, search engine optimization (SEO), and pay-per-click (PPC) campaign parameters.\n"
            "- Excellent communication skills and familiarity with design platforms (Canva, Figma).\n\n"
            "## Evaluation Criteria\n"
            "- Marketing Case Study Assignment: >= 80%\n"
            "- Analytics & SEO Interview: Pass\n"
            "- Communication Alignment: >= 80%"
        )
    else:
        title = "Enterprise Systems & Python Developer"
        department = "Engineering"
        criteria = "Python, REST APIs, Git, PostgreSQL, FastAPI"
        description = (
            "# Job Profile: Enterprise Systems & Python Developer\n"
            "We are looking for a skilled backend developer to construct microservices, manage databases, and build scalable core structures.\n\n"
            "## Key Responsibilities\n"
            "- Build and configure secure REST APIs using Python, FastAPI, and SQLAlchemy.\n"
            "- Design robust PostgreSQL relational schemas, indexes, and caching strategies.\n"
            "- Setup continuous integration pipelines (CI/CD) and manage services deployment.\n"
            "- Audit platform security, implement roles-based auth checks, and maintain detailed transaction logs.\n\n"
            "## Requirements\n"
            "- 3+ years experience building production backend systems using Python, FastAPI, or Django.\n"
            "- Solid understanding of database architecture, SQL optimization, and key-value store cache systems.\n"
            "- Familiarity with Git, Docker, and shell automation scripting.\n\n"
            "## Evaluation Criteria\n"
            "- Live Technical Coding Assignment: >= 80%\n"
            "- System Architecture Design: Pass\n"
            "- Relational Database Schema Design: >= 75%"
        )
    return {
        "title": title,
        "department": department,
        "criteria": criteria,
        "description": description,
        "threshold_score": 80
    }


def parse_jd_response_text(text: str) -> GenerateJdResponse:
    import json
    import re

    def sanitize_json_escapes(s: str) -> str:
        # Replace invalid escape sequences: \\- \\DST etc.
        def fix_escape(m):
            char = m.group(1)
            valid = {'"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u'}
            if char in valid:
                return m.group(0)  # Keep valid escapes as-is
            return char  # Drop the backslash for invalid escapes
        return re.sub(r'\\(.)', fix_escape, s)

    def extract_and_parse_json(raw: str):
        """Try multiple strategies to extract and parse JSON from the raw text."""
        # Strategy 1: Strip markdown code fences and try direct parse
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```[a-zA-Z]*\n?", "", cleaned)
            cleaned = re.sub(r"\n?```$", "", cleaned)
            cleaned = cleaned.strip()

        # Strategy 2: Find first { to last } (handles text before/after JSON)
        brace_match = re.search(r'\{[\s\S]*\}', cleaned)
        candidates = []
        if brace_match:
            candidates.append(brace_match.group(0))
        candidates.append(cleaned)  # Also try the whole text

        for candidate in candidates:
            # Try raw parse first
            try:
                data = json.loads(candidate)
                if isinstance(data, dict):
                    return data
            except Exception:
                pass

            # Try after sanitizing invalid escape sequences
            try:
                sanitized = sanitize_json_escapes(candidate)
                data = json.loads(sanitized)
                if isinstance(data, dict):
                    return data
            except Exception:
                pass

            # Try removing all lone backslashes before non-special chars
            try:
                # More aggressive: replace any \X where X is not a valid escape
                aggressive = re.sub(r'\\([^"\\/bfnrtu])', r'\1', candidate)
                data = json.loads(aggressive)
                if isinstance(data, dict):
                    return data
            except Exception:
                pass

        return None

    # ── Primary: JSON extraction ──────────────────────────────────────────────
    data = extract_and_parse_json(text)
    if data:
        title = data.get("title") or data.get("TITLE") or ""
        dept  = data.get("department") or data.get("DEPARTMENT") or "Engineering"
        crit  = data.get("criteria") or data.get("CRITERIA") or ""
        desc  = data.get("description") or data.get("DESCRIPTION") or ""

        if isinstance(crit, list):
            crit = ", ".join(crit)
        if isinstance(desc, list):
            desc = "\n".join(str(x) for x in desc)

        if title and desc:
            return GenerateJdResponse(
                title=str(title).strip(),
                department=str(dept).strip(),
                criteria=str(crit).strip(),
                description=str(desc).strip(),
                threshold_score=80
            )

    # ── Fallback: Regex heuristic line-parser ─────────────────────────────────
    print(f"[JD Parser] JSON extraction failed; falling back to regex heuristics. Text[:200]: {text[:200]}")

    title      = "Enterprise Systems Developer"
    department = "Engineering"
    criteria   = "Python, REST APIs, Git"
    description = text

    title_match = re.search(r"(?i)^TITLE:\s*(.*)", text, re.MULTILINE)
    dept_match  = re.search(r"(?i)^DEPARTMENT:\s*(.*)", text, re.MULTILINE)
    crit_match  = re.search(r"(?i)^CRITERIA:\s*(.*)", text, re.MULTILINE)

    if title_match:
        title = title_match.group(1).strip()
    if dept_match:
        department = dept_match.group(1).strip()
    if crit_match:
        criteria = crit_match.group(1).strip()

    desc_match = re.search(r"(?i)DESCRIPTION:\s*(.*)", text, re.DOTALL)
    if desc_match:
        description = desc_match.group(1).strip()
    else:
        clean_desc = text
        for pat in [r"(?i)^TITLE:.*?\n", r"(?i)^DEPARTMENT:.*?\n",
                    r"(?i)^CRITERIA:.*?\n", r"(?i)^DESCRIPTION:.*?\n"]:
            clean_desc = re.sub(pat, "", clean_desc, flags=re.MULTILINE)
        description = re.sub(r"-{3,}", "", clean_desc).strip()

    title      = re.sub(r"^[-#\s*]+", "", title).strip()
    department = re.sub(r"^[-#\s*]+", "", department).strip()
    criteria   = re.sub(r"^[-#\s*]+", "", criteria).strip()

    # Last resort: try to extract title from first markdown H1
    if title == "Enterprise Systems Developer":
        h1_match = re.search(r"^#\s+(.+)$", text, re.MULTILINE)
        if h1_match:
            title = h1_match.group(1).strip()

    return GenerateJdResponse(
        title=title,
        department=department,
        criteria=criteria,
        description=description,
        threshold_score=80
    )


@router.post("/jobs/generate-jd", response_model=GenerateJdResponse)
async def generate_job_description(
    payload: GenerateJdRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
):
    provider = settings.ai_provider or "gemini"
    
    # ─── Dynamic Fallback Checks ───────────────────────────────────
    if provider == "openai" and not settings.openai_api_key:
        if settings.anthropic_api_key:
            provider = "claude"
        elif settings.gemini_api_key:
            provider = "gemini"
        else:
            res = generate_fallback_jd(payload.prompt)
            return GenerateJdResponse(**res)
            
    if provider == "claude" and not settings.anthropic_api_key:
        if settings.gemini_api_key:
            provider = "gemini"
        elif settings.openai_api_key:
            provider = "openai"
        else:
            res = generate_fallback_jd(payload.prompt)
            return GenerateJdResponse(**res)
            
    if provider == "gemini" and not settings.gemini_api_key:
        if settings.anthropic_api_key:
            provider = "claude"
        elif settings.openai_api_key:
            provider = "openai"
        else:
            res = generate_fallback_jd(payload.prompt)
            return GenerateJdResponse(**res)

    instruction = (
        "You are an elite enterprise HR Director and technical recruiter with 20 years of experience. "
        "Your task: generate a COMPLETE, highly detailed, enterprise-grade Job Description (JD) based on the following context:\n\n"
        f"{payload.prompt}\n\n"
        "STRICT RULES:\n"
        "1. Extract the exact job title, department, experience level, and required skills FROM the context above — do NOT use generic defaults.\n"
        "2. If the context already contains a JD (pasted text), use ALL the information in it — role name, responsibilities, skills, requirements — and enhance/restructure it into a perfect enterprise JD.\n"
        "3. Format the description in beautiful markdown with ALL these sections:\n"
        "   # [Exact Job Title from context]\n"
        "   ## About the Role\n"
        "   ## Key Responsibilities\n"
        "   ## Required Qualifications & Experience\n"
        "   ## Technical Skills & Stack\n"
        "   ## Behavioral Competencies\n"
        "   ## What Success Looks Like (first 90 days)\n"
        "   ## Compensation & Benefits\n"
        "   ## Structured Evaluation Criteria (with specific threshold scores)\n"
        "4. The 'criteria' field must list the ACTUAL key skills from the JD (comma-separated, 5-8 specific terms).\n"
        "5. The 'department' must reflect the actual department (e.g., 'Data Science & Analytics', 'Engineering', 'Operations').\n"
        "6. Return ONLY a raw JSON object (no markdown code fences, no extra text) matching exactly this schema:\n"
        '{"title": "...", "department": "...", "criteria": "...", "description": "..."}\n\n'
        "IMPORTANT: Keep your thinking/reasoning process extremely brief (under 300 tokens) to ensure the JSON fits in the token window and is not truncated."
    )
    
    import requests
    
    # ─── OpenAI Provider execution ────────────────────────────────
    if provider == "openai":
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.openai_api_key}"
        }
        body = {
            "model": settings.openai_model or "gpt-4o",
            "messages": [
                {"role": "user", "content": instruction}
            ]
        }
        try:
            response = requests.post(url, json=body, headers=headers, timeout=30)
            response.raise_for_status()
            res_json = response.json()
            text = res_json["choices"][0]["message"]["content"]
            return parse_jd_response_text(text)
        except Exception as e:
            print(f"OpenAI API request failed, falling back. Error: {e}")
            res = generate_fallback_jd(payload.prompt)
            return GenerateJdResponse(**res)
            
    # ─── Claude / Anthropic Provider execution ────────────────────
    elif provider == "claude":
        url = f"{settings.anthropic_base_url.rstrip('/')}/v1/messages"
        headers = {
            "x-api-key": settings.anthropic_api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        body = {
            "model": settings.anthropic_model or "claude-3-5-sonnet-20241022",
            "max_tokens": 8192,
            "messages": [
                {"role": "user", "content": instruction}
            ]
        }
        try:
            response = requests.post(url, json=body, headers=headers, timeout=60)
            response.raise_for_status()
            res_json = response.json()
            
            # Debug log the response structure
            print(f"[Claude JD] Response keys: {list(res_json.keys())}")
            
            # Handle multiple possible response formats from different proxy providers
            text = None
            
            # Standard Anthropic format: {"content": [{"type": "text", "text": "..."}, ...]}
            # Extended thinking mode adds a "thinking" block BEFORE the text block — loop to find type="text"
            if "content" in res_json and isinstance(res_json["content"], list):
                for block in res_json["content"]:
                    if isinstance(block, dict):
                        block_type = block.get("type", "")
                        if block_type == "text":
                            text = block.get("text")
                            break
                        elif block_type == "thinking":
                            # Skip thinking/reasoning blocks
                            continue
                # Fallback: use first block if no text-typed block found
                if not text and res_json["content"]:
                    first_block = res_json["content"][0]
                    text = first_block.get("text") or first_block.get("content")
            
            # OpenAI-compatible format: {"choices": [{"message": {"content": "..."}}]}
            elif "choices" in res_json and res_json["choices"]:
                msg = res_json["choices"][0].get("message", {})
                text = msg.get("content") or msg.get("text")
            
            # Direct text field
            elif "text" in res_json:
                text = res_json["text"]
            
            # Flat message field
            elif "message" in res_json:
                msg = res_json["message"]
                if isinstance(msg, str):
                    text = msg
                elif isinstance(msg, dict):
                    text = msg.get("content") or msg.get("text")
            
            # Output field (some proxies)
            elif "output" in res_json:
                text = str(res_json["output"])

            if not text:
                print(f"[Claude JD] Unexpected response format: {res_json}")
                raise ValueError(f"Could not extract text from response. Keys: {list(res_json.keys())}")
            
            return parse_jd_response_text(text)
        except Exception as e:
            print(f"Claude API request failed, falling back to Gemini. Error: {e}")
            # Try Gemini as secondary fallback if key available
            if settings.gemini_api_key:
                try:
                    api_key = settings.gemini_api_key
                    model = settings.gemini_model or "gemini-3.6-flash"
                    gurl = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
                    gbody = {"contents": [{"parts": [{"text": instruction}]}]}
                    gresp = requests.post(gurl, json=gbody, headers={"Content-Type": "application/json"}, timeout=20)
                    gresp.raise_for_status()
                    gtext = gresp.json()["candidates"][0]["content"]["parts"][0]["text"]
                    return parse_jd_response_text(gtext)
                except Exception as ge:
                    print(f"Gemini fallback also failed: {ge}")
            res = generate_fallback_jd(payload.prompt)
            return GenerateJdResponse(**res)
            
    # ─── Gemini Provider execution ────────────────────────────────
    else:
        api_key = settings.gemini_api_key
        model = settings.gemini_model or "gemini-3.6-flash"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}
        body = {
            "contents": [{
                "parts": [{
                    "text": instruction
                }]
            }]
        }
        try:
            response = requests.post(url, json=body, headers=headers, timeout=20)
            response.raise_for_status()
            res_json = response.json()
            text = res_json["candidates"][0]["content"]["parts"][0]["text"]
            return parse_jd_response_text(text)
        except Exception as e:
            print(f"Gemini API request failed, falling back. Error: {e}")
            res = generate_fallback_jd(payload.prompt)
            return GenerateJdResponse(**res)


@router.patch("/jobs/{id}", response_model=JobOpeningResponse)
async def update_job(
    id: uuid.UUID,
    payload: JobOpeningUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    job = await db.get(JobOpening, id)
    if not job or job.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Job opening not found")

    old_values = {}
    new_values = {}

    for k, v in payload.model_dump(exclude_unset=True).items():
        old_v = getattr(job, k)
        old_values[k] = old_v
        new_values[k] = v
        setattr(job, k, v)

    await db.commit()
    await db.refresh(job)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="hrms_recruitment",
        action="update_job_opening",
        entity_type="JobOpening",
        entity_id=job.id,
        old_values=old_values,
        new_values=new_values,
    )
    await db.commit()
    return job


@router.delete("/jobs/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(
    id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    job = await db.get(JobOpening, id)
    if not job or job.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Job opening not found")

    await db.delete(job)
    await db.commit()

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="hrms_recruitment",
        action="delete_job_opening",
        entity_type="JobOpening",
        entity_id=id,
        old_values={"title": job.title},
    )
    await db.commit()
    return None


# ─── Applicants ───────────────────────────────────────────────────────────────

@router.get("/applicants", response_model=PaginatedResponse[ApplicantResponse])
async def list_applicants(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    job_id: uuid.UUID | None = None,
    stage: str | None = None,
    source: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str | None = None,
):
    query = select(Applicant).where(Applicant.tenant_id == ctx.tenant_id)
    if job_id:
        query = query.where(Applicant.job_id == job_id)
    if stage:
        query = query.where(Applicant.stage.ilike(stage))
    if source:
        query = query.where(Applicant.source.ilike(source))
    if search:
        query = query.where(
            Applicant.name.ilike(f"%{search}%")
            | Applicant.email.ilike(f"%{search}%")
            | Applicant.job_title.ilike(f"%{search}%")
        )

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(Applicant.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/applicants", response_model=ApplicantResponse, status_code=status.HTTP_201_CREATED)
async def create_manual_applicant(
    payload: ApplicantCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    target_job_title = payload.job_title or "General Applicant"
    match_score = 75

    if payload.job_id:
        job = await db.get(JobOpening, payload.job_id)
        if job and job.tenant_id == ctx.tenant_id:
            target_job_title = job.title
            match_score = calculate_match_score(payload.resume_text, job.criteria)
            job.applicants_count += 1

    new_applicant = Applicant(
        tenant_id=ctx.tenant_id,
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        job_id=payload.job_id,
        job_title=target_job_title,
        experience=payload.experience or "Fresher / Entry",
        rating=0,
        stage=payload.stage or "Applied",
        source=payload.source or "Manual Entry",
        match_score=match_score,
        resume_text=payload.resume_text,
        expected_salary=payload.expected_salary,
        proposed_salary=payload.proposed_salary,
        notice_period_days=payload.notice_period_days or 30,
    )

    db.add(new_applicant)
    await db.flush()

    await add_system_notification(
        db,
        ctx.tenant_id,
        f"Manual Candidate Registered: {new_applicant.name}",
        f"Candidate '{new_applicant.name}' registered manually for '{new_applicant.job_title}' in stage '{new_applicant.stage}'.",
        "hrms"
    )

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="hrms_recruitment",
        action="create_manual_applicant",
        entity_type="Applicant",
        entity_id=new_applicant.id,
        new_values={"name": new_applicant.name, "email": new_applicant.email, "role": new_applicant.job_title},
    )

    await db.commit()
    await db.refresh(new_applicant)
    return new_applicant


@router.post("/jobs/{job_id}/apply", response_model=ApplicantResponse, status_code=status.HTTP_201_CREATED)
async def submit_application(
    job_id: uuid.UUID,
    payload: ApplicantCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    job = await db.get(JobOpening, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job opening not found")

    match_score = calculate_match_score(payload.resume_text, job.criteria)

    new_applicant = Applicant(
        tenant_id=job.tenant_id,
        name=payload.name,
        email=payload.email,
        job_id=job_id,
        job_title=job.title,
        experience=payload.experience,
        rating=0,
        stage="Applied",
        source=payload.source,
        match_score=match_score,
        resume_text=payload.resume_text,
    )
    
    job.applicants_count += 1
    
    db.add(new_applicant)
    await db.flush()
    await add_system_notification(
        db, 
        job.tenant_id, 
        f"New Candidate Applied: {new_applicant.name}", 
        f"Candidate '{new_applicant.name}' applied for '{new_applicant.job_title}' (Match Score: {new_applicant.match_score}%) via {new_applicant.source or 'Direct portal'}", 
        "hrms"
    )
    await db.commit()
    await db.refresh(new_applicant)
    return new_applicant


@router.patch("/applicants/{id}", response_model=ApplicantResponse)
async def update_applicant(
    id: uuid.UUID,
    payload: ApplicantUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    applicant = await db.get(Applicant, id)
    if not applicant or applicant.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Applicant not found")

    old_stage = applicant.stage
    
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(applicant, k, v)

    await db.commit()
    await db.refresh(applicant)

    if old_stage != applicant.stage:
        await write_audit_log(
            db,
            tenant_id=ctx.tenant_id,
            user_id=ctx.user.id,
            module="hrms_recruitment",
            action="advance_applicant_stage",
            entity_type="Applicant",
            entity_id=applicant.id,
            old_values={"stage": old_stage},
            new_values={"stage": applicant.stage},
        )
        await db.commit()

    return applicant


class AddNoteRequest(BaseModel):
    text: str


@router.post("/applicants/{id}/notes", response_model=ApplicantResponse)
async def add_applicant_note(
    id: uuid.UUID,
    payload: AddNoteRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    applicant = await db.get(Applicant, id)
    if not applicant or applicant.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Applicant not found")

    new_note = {
        "author": ctx.user.full_name or "HR Officer",
        "date": datetime.now().isoformat(),
        "text": payload.text
    }

    current_notes = list(applicant.notes_json or [])
    current_notes.insert(0, new_note)  # Put newest notes first
    applicant.notes_json = current_notes

    await db.commit()
    await db.refresh(applicant)
    return applicant



# ─── Interviews ───────────────────────────────────────────────────────────────

@router.get("/interviews", response_model=PaginatedResponse[InterviewResponse])
async def list_interviews(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    query = select(Interview).where(Interview.tenant_id == ctx.tenant_id)
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(Interview.date.desc(), Interview.time.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.get("/interviews/check-overlap")
async def check_overlap(
    interviewer: str,
    date: str,
    time: str,
    duration: int,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        req_h, req_m = map(int, time.split(":"))
        req_start = req_h + req_m / 60.0
        req_end = req_start + duration / 60.0
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid time format. Use HH:MM")

    stmt = select(Interview).where(
        and_(
            Interview.tenant_id == ctx.tenant_id,
            Interview.interviewer_name == interviewer,
            Interview.date == date,
            Interview.status == "Scheduled"
        )
    )
    result = await db.execute(stmt)
    records = result.scalars().all()

    for rec in records:
        try:
            ex_h, ex_m = map(int, rec.time.split(":"))
            ex_start = ex_h + ex_m / 60.0
            ex_end = ex_start + rec.duration / 60.0

            if req_start < ex_end and req_end > ex_start:
                return {
                    "conflict": True,
                    "candidate": rec.candidate,
                    "time": rec.time,
                    "duration": rec.duration,
                    "detail": f"Interviewer already scheduled for candidate '{rec.candidate}' at {rec.time} for {rec.duration} minutes."
                }
        except Exception:
            continue

    return {"conflict": False}


@router.post("/interviews", response_model=InterviewResponse, status_code=status.HTTP_201_CREATED)
async def schedule_interview(
    payload: InterviewCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    applicant = await db.get(Applicant, payload.applicant_id)
    if not applicant or applicant.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Candidate applicant profile not found")

    conflict_check = await check_overlap(
        interviewer=payload.interviewer_name,
        date=payload.date,
        time=payload.time,
        duration=payload.duration,
        ctx=ctx,
        db=db
    )
    if conflict_check["conflict"]:
        raise HTTPException(status_code=409, detail=conflict_check["detail"])

    meet_id = f"{uuid.uuid4().hex[:3]}-{uuid.uuid4().hex[:4]}-{uuid.uuid4().hex[:3]}"
    meeting_link = f"https://meet.google.com/{meet_id}" if payload.mode == "Video Call" else None

    new_int = Interview(
        tenant_id=ctx.tenant_id,
        applicant_id=payload.applicant_id,
        candidate=applicant.name,
        job_title=applicant.job_title,
        interviewer_name=payload.interviewer_name,
        date=payload.date,
        time=payload.time,
        duration=payload.duration,
        type=payload.type,
        mode=payload.mode,
        meeting_link=meeting_link,
        status="Scheduled",
    )
    db.add(new_int)
    await db.commit()
    await db.refresh(new_int)

    # Trigger Live Email Notification to candidate
    email_body = (
        f"Dear {applicant.name},\n\n"
        f"You have been scheduled for a recruitment selection interview for the position of: {applicant.job_title}.\n\n"
        f"Session Details:\n"
        f"- Interviewer: {payload.interviewer_name}\n"
        f"- Date: {payload.date}\n"
        f"- Time: {payload.time}\n"
        f"- Duration: {payload.duration} minutes\n"
        f"- Interview Type: {payload.type}\n"
        f"- Mode: {payload.mode}\n"
    )
    if meeting_link:
        email_body += f"- Google Meet Video Link: {meeting_link}\n"
    email_body += "\nBest regards,\nHR Team · Nimbus Retail Group"
    
    await send_recruitment_email(applicant.email, f"Interview Scheduled: {applicant.job_title} - Nimbus Retail", email_body)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="hrms_recruitment",
        action="schedule_interview",
        entity_type="Interview",
        entity_id=new_int.id,
        new_values={"candidate": applicant.name, "date": payload.date, "time": payload.time},
    )
    await db.commit()
    return new_int


@router.patch("/interviews/{id}", response_model=InterviewResponse)
async def update_interview(
    id: uuid.UUID,
    payload: InterviewUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    intvw = await db.get(Interview, id)
    if not intvw or intvw.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Interview not found")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(intvw, k, v)

    await db.commit()
    await db.refresh(intvw)
    return intvw


# ─── Offer Letters ────────────────────────────────────────────────────────────

@router.get("/offers", response_model=PaginatedResponse[OfferLetterResponse])
async def list_offers(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    query = select(OfferLetter).where(OfferLetter.tenant_id == ctx.tenant_id)
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(OfferLetter.offer_date.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.get("/offers/{id}", response_model=OfferLetterResponse)
async def get_offer(
    id: str,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    clean_id = id.replace(".pdf", "").strip()
    try:
        u_id = uuid.UUID(clean_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid offer ID format")
    offer = await db.get(OfferLetter, u_id)
    if not offer or offer.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Offer letter not found")
    return offer


@router.get("/public/offers/{id}", response_model=OfferLetterResponse)
async def get_public_offer(
    id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    clean_id = id.replace(".pdf", "").strip()
    try:
        u_id = uuid.UUID(clean_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid offer ID format")
    offer = await db.get(OfferLetter, u_id)
    if not offer:
        raise HTTPException(status_code=404, detail="Offer letter not found")
    return offer


@router.post("/offers", response_model=OfferLetterResponse, status_code=status.HTTP_201_CREATED)
async def create_offer(
    payload: OfferLetterCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    candidate_name = payload.candidate
    candidate_role = payload.role or "Team Member"
    candidate_email = payload.candidate_email

    applicant = None
    employee = None

    if payload.employee_id:
        employee = await db.get(Employee, payload.employee_id)
        if not employee or employee.tenant_id != ctx.tenant_id:
            raise HTTPException(status_code=404, detail="Employee not found")
        candidate_name = payload.candidate or employee.full_name
        candidate_email = payload.candidate_email or employee.email
        if employee.designation_id:
            from src.models import Designation
            desig = await db.get(Designation, employee.designation_id)
            if desig:
                candidate_role = desig.name
        elif hasattr(employee, "position") and employee.position:
            candidate_role = employee.position
    elif payload.applicant_id:
        applicant = await db.get(Applicant, payload.applicant_id)
        if not applicant or applicant.tenant_id != ctx.tenant_id:
            raise HTTPException(status_code=404, detail="Applicant profile not found")
        candidate_name = applicant.name
        candidate_email = applicant.email
        candidate_role = applicant.job_title
        # Advance applicant stage
        applicant.stage = "Offer"
    else:
        if not candidate_name:
            raise HTTPException(status_code=400, detail="Must provide either applicant_id, employee_id, or candidate name")

    new_offer = OfferLetter(
        tenant_id=ctx.tenant_id,
        applicant_id=payload.applicant_id,
        employee_id=payload.employee_id,
        candidate=candidate_name or "Candidate",
        candidate_email=candidate_email,
        role=candidate_role,
        ctc=payload.ctc,
        offer_date=date.today(),
        expiry_date=payload.expiry_date,
        joining_date=payload.joining_date,
        signer_name=payload.signer_name,
        status="Awaiting Acceptance",
        custom_template=payload.custom_template,
    )
    db.add(new_offer)
    await db.flush()

    # If this is for an existing employee, automatically store a record in EmployeeDocument (Document Vault)
    if employee:
        doc_entry = EmployeeDocument(
            tenant_id=ctx.tenant_id,
            employee_id=employee.id,
            document_name=f"Offer Letter - {candidate_role} ({new_offer.joining_date.strftime('%b %Y') if new_offer.joining_date else date.today().strftime('%b %Y')})",
            document_type="Contract",
            file_path=f"/vault/offers/{new_offer.id}.pdf",
            upload_date=date.today(),
            status="Valid",
        )
        db.add(doc_entry)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="hrms_recruitment",
        action="create_offer_letter",
        entity_type="OfferLetter",
        entity_id=new_offer.id,
        new_values={
            "candidate": candidate_name,
            "role": candidate_role,
            "ctc": payload.ctc,
            "employee_id": str(payload.employee_id) if payload.employee_id else None,
            "applicant_id": str(payload.applicant_id) if payload.applicant_id else None,
        },
    )
    await db.commit()
    await db.refresh(new_offer)
    return new_offer


@router.post("/offers/{id}/send-email")
async def send_offer_email(
    id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    offer = await db.get(OfferLetter, id)
    if not offer or offer.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Offer letter not found")

    # Fetch candidate email
    target_email = offer.candidate_email
    if not target_email and offer.applicant_id:
        applicant = await db.get(Applicant, offer.applicant_id)
        if applicant:
            target_email = applicant.email
    if not target_email and offer.employee_id:
        employee = await db.get(Employee, offer.employee_id)
        if employee:
            target_email = employee.email

    if not target_email:
        raise HTTPException(status_code=400, detail="Candidate email address could not be resolved")

    tenant = await db.scalar(select(Tenant).where(Tenant.id == ctx.tenant_id))
    company_name = tenant.name if tenant else "LazyMonkeyAI"

    server_base = getattr(settings, "app_public_url", None) or "https://lazymonkeyai.com"
    if server_base.endswith("/"):
        server_base = server_base[:-1]

    accept_url = f"{server_base}/api/v1/hrms/public/offers/respond?id={offer.id}&action=accept&email={target_email}"
    decline_url = f"{server_base}/api/v1/hrms/public/offers/respond?id={offer.id}&action=decline&email={target_email}"

    # Plain text fallback
    plain_body = (
        f"Dear {offer.candidate},\n\n"
        f"We are pleased to extend this formal offer of employment to join {company_name} as a {offer.role}.\n\n"
        f"Offer Terms:\n"
        f"- Compensation: ₹{offer.ctc:,.2f} per annum (Gross CTC)\n"
        f"- Target Start Date: {offer.joining_date}\n"
        f"- Offer Expiration: {offer.expiry_date}\n\n"
        f"To accept this offer online, click here: {accept_url}\n"
        f"To decline this offer, click here: {decline_url}\n\n"
        f"Sincerely,\n{offer.signer_name}\nHuman Resources Department\n{company_name}"
    )

    # Rich responsive HTML template
    html_body = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Employment Offer: {offer.role} - {company_name}</title>
      <style>
        body {{ margin: 0; padding: 24px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; }}
        .email-container {{ max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); }}
        .brand-header {{ background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 36px 32px; color: #ffffff; }}
        .brand-logo {{ font-size: 22px; font-weight: 900; letter-spacing: -0.5px; margin: 0; }}
        .brand-subtitle {{ margin: 4px 0 0 0; font-size: 13px; opacity: 0.9; }}
        .email-body {{ padding: 36px 32px; }}
        .salutation {{ font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 12px; }}
        .intro-text {{ font-size: 14px; line-height: 1.65; color: #334155; margin-bottom: 24px; }}
        .offer-card {{ background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 24px; margin-bottom: 28px; }}
        .offer-card-title {{ font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }}
        .detail-row {{ display: table; width: 100%; margin-bottom: 10px; font-size: 14px; }}
        .detail-label {{ display: table-cell; width: 45%; color: #64748b; font-weight: 600; vertical-align: top; }}
        .detail-val {{ display: table-cell; width: 55%; color: #0f172a; font-weight: 700; text-align: right; vertical-align: top; }}
        .highlight-ctc {{ color: #059669 !important; font-size: 16px !important; }}
        .button-container {{ text-align: center; margin: 32px 0 20px 0; }}
        .btn-accept {{ display: inline-block; padding: 14px 36px; background-color: #10b981; color: #ffffff !important; text-decoration: none; font-size: 15px; font-weight: 800; border-radius: 12px; box-shadow: 0 4px 14px rgba(16,185,129,0.35); margin: 0 8px 10px 0; }}
        .btn-decline {{ display: inline-block; padding: 14px 24px; background-color: #ffffff; color: #ef4444 !important; text-decoration: none; font-size: 14px; font-weight: 700; border: 1.5px solid #fca5a5; border-radius: 12px; margin: 0 0 10px 0; }}
        .signature-block {{ margin-top: 32px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b; line-height: 1.5; }}
        .signature-name {{ font-weight: 700; color: #0f172a; font-size: 14px; }}
        .email-footer {{ background: #f8fafc; padding: 24px 32px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.5; }}
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="brand-header">
          <div class="brand-logo">🐒 {company_name}</div>
          <div class="brand-subtitle">Official Employment Offer & Appointment Confirmation</div>
        </div>
        <div class="email-body">
          <div class="salutation">Dear {offer.candidate},</div>
          <div class="intro-text">
            We are thrilled to extend an offer of employment to join <strong>{company_name}</strong> as <strong>{offer.role}</strong>.
            Our leadership and team members were deeply impressed by your experience and credentials.
          </div>

          <div class="offer-card">
            <div class="offer-card-title">Key Offer Summary</div>
            <div class="detail-row">
              <div class="detail-label">Position / Role:</div>
              <div class="detail-val">{offer.role}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Annual Gross CTC:</div>
              <div class="detail-val highlight-ctc">₹{offer.ctc:,.2f} / annum</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Target Joining Date:</div>
              <div class="detail-val">{offer.joining_date}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Offer Expiration:</div>
              <div class="detail-val">{offer.expiry_date}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Authorizing Signer:</div>
              <div class="detail-val">{offer.signer_name}</div>
            </div>
          </div>

          <p style="font-size: 13px; color: #475569; text-align: center; margin: 0 0 16px 0;">
            Please respond directly using the options below before <strong>{offer.expiry_date}</strong>:
          </p>

          <div class="button-container">
            <a href="{accept_url}" class="btn-accept">✅ Accept Offer Online</a>
            <a href="{decline_url}" class="btn-decline">❌ Decline Offer</a>
          </div>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin: 20px 0; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #475569; font-weight: 600;">
              📎 <strong>Official Offer Letter PDF Attached:</strong> A formal, digitally authorized PDF copy of this offer letter is attached to this email for your review and records.
            </p>
          </div>

          <div class="signature-block">
            Warm regards,<br>
            <span class="signature-name">{offer.signer_name}</span><br>
            Human Resources & Talent Operations<br>
            <strong>{company_name}</strong>
          </div>
        </div>
        <div class="email-footer">
          &copy; {datetime.now().year} {company_name}. Powered by LazyMonkeyAI BusinessOS.<br>
          This is an official automated communication intended solely for {target_email}.
        </div>
      </div>
    </body>
    </html>
    """

    # Generate official high-resolution PDF document attachment
    pdf_bytes = generate_offer_letter_pdf(offer, company_name, tenant)
    pdf_filename = f"Official_Offer_Letter_{(offer.candidate or 'Candidate').replace(' ', '_')}.pdf"

    # Persist copy to static vault directory for direct file serving
    try:
        vault_dir = Path("static/vault/offers")
        vault_dir.mkdir(parents=True, exist_ok=True)
        (vault_dir / f"{offer.id}.pdf").write_bytes(pdf_bytes)
    except Exception as e:
        print(f"[VAULT PDF WRITE NOTICE]: {e}")

    # Resolve target company for tenant/company SMTP credentials
    target_company_id = None
    if offer.employee_id:
        from src.models import Employee
        emp = await db.get(Employee, offer.employee_id)
        if emp and emp.company_id:
            target_company_id = emp.company_id

    if not target_company_id:
        from src.models import Company
        primary_comp = await db.scalar(
            select(Company).where(Company.tenant_id == ctx.tenant_id, Company.status == "active").order_by(Company.created_at.asc())
        )
        if primary_comp:
            target_company_id = primary_comp.id

    await send_recruitment_email(
        to_email=target_email,
        subject=f"Employment Offer: {offer.role} - {company_name}",
        body_text=plain_body,
        html_body=html_body,
        attachment_bytes=pdf_bytes,
        attachment_filename=pdf_filename,
        tenant_id=ctx.tenant_id,
        company_id=target_company_id,
        db=db,
    )

    offer.email_sent = True
    await db.commit()

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="hrms_recruitment",
        action="send_offer_email",
        entity_type="OfferLetter",
        entity_id=id,
        new_values={"recipient_candidate": offer.candidate, "signer": offer.signer_name, "pdf_attached": pdf_filename},
    )
    await db.commit()
    return {"status": "ok", "message": f"Official offer email with PDF attachment successfully sent to '{offer.candidate}'."}


@router.get("/offers/{id}/download-pdf")
async def download_offer_letter_pdf(
    id: str,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    clean_id = id.replace(".pdf", "").strip()
    try:
        u_id = uuid.UUID(clean_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid offer ID format")
    offer = await db.get(OfferLetter, u_id)
    if not offer or offer.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Offer letter not found")
    tenant = await db.scalar(select(Tenant).where(Tenant.id == offer.tenant_id))
    company_name = tenant.name if tenant else "BusinessOS Enterprise"
    pdf_bytes = generate_offer_letter_pdf(offer, company_name, tenant)
    filename = f"Official_Offer_Letter_{(offer.candidate or 'Candidate').replace(' ', '_')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/public/offers/{id}/download-pdf")
async def download_public_offer_letter_pdf(
    id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    clean_id = id.replace(".pdf", "").strip()
    try:
        u_id = uuid.UUID(clean_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid offer ID format")
    offer = await db.get(OfferLetter, u_id)
    if not offer:
        raise HTTPException(status_code=404, detail="Offer letter not found")
    tenant = await db.scalar(select(Tenant).where(Tenant.id == offer.tenant_id))
    company_name = tenant.name if tenant else "BusinessOS Enterprise"
    pdf_bytes = generate_offer_letter_pdf(offer, company_name, tenant)
    filename = f"Official_Offer_Letter_{(offer.candidate or 'Candidate').replace(' ', '_')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/public/offers/respond", response_class=HTMLResponse)
async def public_offer_response(
    id: uuid.UUID,
    action: str,
    email: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    offer = await db.get(OfferLetter, id)
    if not offer:
        return HTMLResponse(content="<h2>Offer letter not found or expired.</h2>", status_code=404)

    expected_email = offer.candidate_email
    applicant = None
    if offer.applicant_id:
        applicant = await db.get(Applicant, offer.applicant_id)
        if applicant and not expected_email:
            expected_email = applicant.email
    if offer.employee_id:
        from src.models import Employee
        employee = await db.get(Employee, offer.employee_id)
        if employee and not expected_email:
            expected_email = employee.email

    if not expected_email or expected_email.strip().lower() != email.strip().lower():
        return HTMLResponse(content="<h2>Invalid candidate authorization credentials.</h2>", status_code=403)

    tenant = await db.scalar(select(Tenant).where(Tenant.id == offer.tenant_id))
    company_name = tenant.name if tenant else "LazyMonkeyAI"

    if action.lower() == "accept":
        offer.status = "Accepted"
        if applicant:
            applicant.stage = "Hired"
        await db.commit()

        return HTMLResponse(content=f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <title>Offer Accepted — {company_name}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0fdf4; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }}
            .card {{ max-width: 520px; width: 100%; background: #ffffff; border-radius: 24px; padding: 44px 36px; text-align: center; box-shadow: 0 20px 40px rgba(16,185,129,0.12); border: 1.5px solid #86efac; }}
            .icon-badge {{ width: 72px; height: 72px; background: #dcfce7; color: #16a34a; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 36px; margin: 0 auto 24px auto; box-shadow: 0 4px 12px rgba(22,163,74,0.2); }}
            h1 {{ font-size: 24px; font-weight: 900; color: #0f172a; margin: 0 0 10px 0; }}
            p {{ font-size: 15px; color: #334155; line-height: 1.6; margin: 0 0 24px 0; }}
            .meta-box {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px 20px; font-size: 13px; font-weight: 600; color: #1e293b; margin-bottom: 24px; text-align: left; }}
            .meta-row {{ display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #e2e8f0; }}
            .meta-row:last-child {{ border-bottom: none; }}
            .footer-note {{ font-size: 12px; color: #64748b; line-height: 1.5; }}
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon-badge">🎉</div>
            <h1>Congratulations, {offer.candidate}!</h1>
            <p>You have successfully <strong>ACCEPTED</strong> the offer of employment for <strong>{offer.role}</strong> at <strong>{company_name}</strong>.</p>
            <div class="meta-box">
              <div class="meta-row"><span>Position:</span> <span>{offer.role}</span></div>
              <div class="meta-row"><span>Annual CTC:</span> <span style="color: #059669; font-weight: 700;">₹{offer.ctc:,.2f}</span></div>
              <div class="meta-row"><span>Target Joining Date:</span> <span>{offer.joining_date}</span></div>
              <div class="meta-row"><span>Response Status:</span> <span style="color: #16a34a; font-weight: 700;">Verified & Confirmed</span></div>
            </div>
            <p class="footer-note">Our People Operations & Onboarding team has received your confirmation in real-time and will be in touch shortly with your welcome package.</p>
          </div>
        </body>
        </html>
        """)
    else:
        offer.status = "Declined"
        await db.commit()
        return HTMLResponse(content=f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <title>Offer Response Recorded — {company_name}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }}
            .card {{ max-width: 480px; width: 100%; background: #ffffff; border-radius: 20px; padding: 40px 32px; text-align: center; box-shadow: 0 15px 30px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }}
            h1 {{ font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 12px; }}
            p {{ font-size: 14px; color: #64748b; line-height: 1.6; margin-bottom: 16px; }}
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Offer Response Recorded</h1>
            <p>Thank you for letting us know, {offer.candidate}. Your decision to decline the offer has been safely updated in our HRMS records.</p>
            <p style="font-size: 13px; color: #94a3b8;">We sincerely appreciate your time and interest in {company_name}, and wish you continued success.</p>
          </div>
        </body>
        </html>
        """)


@router.patch("/offers/{id}", response_model=OfferLetterResponse)
async def update_offer_status(
    id: uuid.UUID,
    payload: OfferLetterUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    offer = await db.get(OfferLetter, id)
    if not offer or offer.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Offer letter not found")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(offer, k, v)

    await db.commit()
    await db.refresh(offer)

    if payload.status == "Accepted":
        applicant = await db.get(Applicant, offer.applicant_id)
        if applicant:
            applicant.stage = "Hired"
            
            # Auto-create or link Employee in EmployeeManagement
            emp = await db.scalar(
                select(Employee).where(
                    Employee.email == applicant.email,
                    Employee.tenant_id == ctx.tenant_id
                )
            )
            if not emp:
                count = await db.scalar(
                    select(func.count()).select_from(Employee).where(Employee.tenant_id == ctx.tenant_id)
                ) or 0
                seq = str(count + 1).zfill(4)
                emp = Employee(
                    tenant_id=ctx.tenant_id,
                    employee_code=f"EMP-{seq}",
                    full_name=applicant.name,
                    email=applicant.email,
                    date_of_joining=offer.joining_date,
                    employment_type="Full-Time",
                    status="Active",
                    basic_salary=Decimal(str(offer.ctc)),
                )
                db.add(emp)
                await db.flush()

            # Save Offer Letter into Employee Document Vault
            existing_doc = await db.scalar(
                select(EmployeeDocument).where(
                    EmployeeDocument.employee_id == emp.id,
                    EmployeeDocument.document_type == "Offer Letter",
                    EmployeeDocument.tenant_id == ctx.tenant_id
                )
            )
            if not existing_doc:
                doc = EmployeeDocument(
                    tenant_id=ctx.tenant_id,
                    employee_id=emp.id,
                    document_name=f"Official_Offer_Letter_{offer.candidate.replace(' ', '_')}.pdf",
                    document_type="Offer Letter",
                    file_path=f"/hrms/documents/offer_{offer.id}.pdf",
                    upload_date=date.today()
                )
                db.add(doc)

            # Auto-create Onboarding Checklist if not exists
            stmt = select(OnboardingRecord).where(
                and_(
                    OnboardingRecord.tenant_id == ctx.tenant_id,
                    OnboardingRecord.applicant_id == offer.applicant_id
                )
            )
            existing_onb = await db.scalar(stmt)
            
            if not existing_onb:
                new_onb = OnboardingRecord(
                    tenant_id=ctx.tenant_id,
                    applicant_id=offer.applicant_id,
                    new_hire=offer.candidate,
                    role=offer.role,
                    start_date=offer.joining_date,
                    progress=15,
                    tasks_json=[
                        {"task": "IT Workspace Hardware Allocation", "assignedTo": "IT", "status": "In Progress"},
                        {"task": "Corporate Email & Active Directory Setup", "assignedTo": "IT", "status": "Pending"},
                        {"task": "Signed Offer & Identity Document Verification", "assignedTo": "HR", "status": "Done"},
                        {"task": "Background Authentication Check", "assignedTo": "HR", "status": "Pending"},
                        {"task": "Introductory Department Orientation", "assignedTo": "Manager", "status": "Pending"},
                        {"task": "Core Compliance & Security Training", "assignedTo": "HR", "status": "Pending"}
                    ]
                )
                db.add(new_onb)
                
        await db.commit()

    return offer


# ─── Onboarding Records ────────────────────────────────────────────────────────

@router.get("/onboarding", response_model=PaginatedResponse[OnboardingResponse])
async def list_onboardings(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    query = select(OnboardingRecord).where(OnboardingRecord.tenant_id == ctx.tenant_id)
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(OnboardingRecord.start_date.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/onboarding", response_model=OnboardingResponse, status_code=status.HTTP_201_CREATED)
async def create_onboarding(
    payload: OnboardingCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    applicant = await db.get(Applicant, payload.applicant_id)
    if not applicant or applicant.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Applicant not found")

    tasks = [t.model_dump() for t in payload.tasks]

    new_onb = OnboardingRecord(
        tenant_id=ctx.tenant_id,
        applicant_id=payload.applicant_id,
        new_hire=applicant.name,
        role=applicant.job_title,
        start_date=payload.start_date,
        progress=0,
        tasks_json=tasks,
    )
    db.add(new_onb)
    await db.commit()
    await db.refresh(new_onb)
    return new_onb


@router.patch("/onboarding/{id}", response_model=OnboardingResponse)
async def update_onboarding(
    id: uuid.UUID,
    payload: OnboardingUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    onb = await db.get(OnboardingRecord, id)
    if not onb or onb.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Onboarding file not found")

    if payload.tasks is not None:
        old_progress = onb.progress or 0
        tasks = [t.model_dump() for t in payload.tasks]
        onb.tasks_json = tasks
        
        # Recalculate progress dynamically
        if tasks:
            done = sum(1 for t in tasks if t["status"] == "Done")
            onb.progress = int((done / len(tasks)) * 100)
        else:
            onb.progress = 0

        # Send progression update emails on crossing 25%, 50%, or 75%
        new_progress = onb.progress
        milestones = [25, 50, 75]
        crossed_milestone = None
        for m in milestones:
            if old_progress < m <= new_progress:
                crossed_milestone = m

        if crossed_milestone and new_progress < 100:
            applicant = await db.get(Applicant, onb.applicant_id)
            if applicant and applicant.email:
                email_body = (
                    f"Dear {applicant.name},\n\n"
                    f"Great news! Your onboarding checklist progress is now at {new_progress}%.\n\n"
                    "We are track-marking your setup steps. Next tasks are on the checklist. "
                    "Looking forward to having you onboard soon!\n\n"
                    "Best regards,\n"
                    "HR Operations Team"
                )
                await send_recruitment_email(
                    applicant.email,
                    f"Onboarding Progression Update: {new_progress}% Completed",
                    email_body
                )

        if onb.progress == 100:
            from src.models import Employee, Department, Designation, User, Role, UserRole, UserStatus
            from src.utils.security import hash_password
            applicant = await db.get(Applicant, onb.applicant_id)
            if applicant:
                # Check if employee already exists by email
                emp_check = await db.scalar(
                    select(Employee).where(
                        Employee.tenant_id == ctx.tenant_id,
                        Employee.email == applicant.email
                    )
                )
                if not emp_check:
                    # Generate unique employee code
                    count = await db.scalar(
                        select(func.count()).select_from(Employee).where(Employee.tenant_id == ctx.tenant_id)
                    )
                    emp_code = f"EMP-{(count or 0) + 1:04d}"
                    
                    # Find designation matching candidate role
                    designation = await db.scalar(
                        select(Designation).where(
                            Designation.tenant_id == ctx.tenant_id,
                            Designation.name.ilike(f"%{onb.role}%")
                        )
                    )
                    designation_id = designation.id if designation else None
                    
                    # Find department matching job opening
                    job = await db.get(JobOpening, applicant.job_id)
                    dept_id = None
                    if job:
                        department = await db.scalar(
                            select(Department).where(
                                Department.tenant_id == ctx.tenant_id,
                                Department.name.ilike(f"%{job.department}%")
                            )
                        )
                        dept_id = department.id if department else None
                    
                    # 1. Create or fetch User Account
                    user_check = await db.scalar(
                        select(User).where(
                            User.tenant_id == ctx.tenant_id,
                            User.email == applicant.email
                        )
                    )
                    
                    user_id = None
                    if not user_check:
                        temp_pass_hash = hash_password("Welcome123!")
                        new_user = User(
                            tenant_id=ctx.tenant_id,
                            email=applicant.email,
                            password_hash=temp_pass_hash,
                            full_name=applicant.name,
                            employee_id=emp_code,
                            status=UserStatus.ACTIVE,
                            must_change_password=True
                        )
                        db.add(new_user)
                        await db.flush() # Populate new_user.id
                        user_id = new_user.id
                        
                        # Assign 'Employee' Role for limited ESS permissions
                        role = await db.scalar(
                            select(Role).where(
                                Role.tenant_id == ctx.tenant_id,
                                Role.name == "Employee"
                            )
                        )
                        if role:
                            new_ur = UserRole(
                                user_id=user_id,
                                role_id=role.id,
                                is_default=True
                            )
                            db.add(new_ur)
                    else:
                        user_id = user_check.id
                    
                    # 2. Create Employee Linked to the User ID
                    new_employee = Employee(
                        tenant_id=ctx.tenant_id,
                        employee_code=emp_code,
                        full_name=applicant.name,
                        email=applicant.email,
                        phone=None,
                        date_of_joining=date.today(),
                        employment_type="Full-Time",
                        status="Active",
                        basic_salary=None,
                        designation_id=designation_id,
                        department_id=dept_id,
                        user_id=user_id
                    )
                    db.add(new_employee)
                    
                    # Send welcome email notification
                    email_body = (
                        f"Dear {applicant.name},\n\n"
                        "Congratulations! We are pleased to inform you that your onboarding process has been successfully completed.\n\n"
                        f"Welcome to the team at Nimbus Retail! Your official employee profile has been created in our HRMS.\n\n"
                        f"Official Employee Code: {emp_code}\n"
                        f"Designated Role: {onb.role}\n"
                        f"Joining Date: {date.today().strftime('%Y-%m-%d')}\n\n"
                        "Your login credentials for the Employee Self Service (ESS) portal will be sent in a separate communication.\n\n"
                        "If you have any questions, please contact your HR Manager.\n\n"
                        "Best regards,\n"
                        "HR Operations Team\n"
                        "Nimbus Retail Group"
                    )
                    await send_recruitment_email(
                        applicant.email,
                        f"Welcome to the Team! Onboarding Completed - {emp_code}",
                        email_body
                    )

    await db.commit()
    await db.refresh(onb)
    return onb


@router.delete("/onboarding/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_onboarding(
    id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    onb = await db.get(OnboardingRecord, id)
    if not onb or onb.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Onboarding record not found")

    await db.delete(onb)
    await db.commit()
    return None
