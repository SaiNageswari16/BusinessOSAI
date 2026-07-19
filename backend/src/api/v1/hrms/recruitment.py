"""
HRMS — Recruitment & Onboarding Endpoints (Job Openings, Applicants, Interview overlap checker, Offer Letters, Onboarding)
"""
import uuid
import io
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, date, timedelta
from typing import Annotated

import pypdf
from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUserContext, require_permission
from src.config import get_settings
from src.database.init_db import write_audit_log
from src.database.session import get_db
from src.models import JobOpening, Applicant, Interview, OfferLetter, OnboardingRecord
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
settings = get_settings()

# ─── SMTP Live Email Dispatch Utility ───────────────────────────────────────────

async def send_recruitment_email(to_email: str, subject: str, body_text: str) -> bool:
    if not settings.mail_server:
        # Log to server console if SMTP credentials are not yet configured in .env
        print(f"\n=================== REALTIME SMTP DISPATCH LOG ===================")
        print(f"TO: {to_email}")
        print(f"SUBJECT: {subject}")
        print(f"BODY:\n{body_text}")
        print(f"==================================================================\n")
        return False

    try:
        msg = MIMEMultipart()
        msg["From"] = settings.mail_from or "recruitment@businessos.ai"
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body_text, "plain"))

        # Connect and authenticate
        server = smtplib.SMTP(settings.mail_server, settings.mail_port or 587)
        server.starttls()
        if settings.mail_username and settings.mail_password:
            server.login(settings.mail_username, settings.mail_password)

        server.send_message(msg)
        server.quit()
        print(f"[SMTP SUCCESS] Successfully sent real email to {to_email}")
        return True
    except Exception as e:
        print(f"[SMTP ERROR] Failed to deliver email to {to_email}: {e}")
        return False


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


@router.post("/jobs/generate-jd", response_model=GenerateJdResponse)
async def generate_job_description(
    payload: GenerateJdRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
):
    api_key = settings.gemini_api_key
    if not api_key:
        res = generate_fallback_jd(payload.prompt)
        return GenerateJdResponse(**res)

    import requests
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    
    instruction = (
        "You are an expert HR Specialist and Recruiter. Based on this prompt: "
        f"'{payload.prompt}', generate a highly detailed, professional, enterprise-level Job Description (JD).\n"
        "Format your entire response EXACTLY as a string conforming to the following structure:\n"
        "---\n"
        "TITLE: [Suggest a job title, e.g. Senior Frontend Engineer]\n"
        "DEPARTMENT: [Suggest a department, e.g. Engineering, Sales, Marketing, HR, Finance, Operations]\n"
        "CRITERIA: [Provide 3-5 comma-separated keywords/technologies for resume criteria matching]\n"
        "DESCRIPTION:\n"
        "[Detailed multi-paragraph description, responsibilities, requirements, and evaluation metrics with threshold scores]\n"
        "---"
    )
    
    body = {
        "contents": [{
            "parts": [{
                "text": instruction
            }]
        }]
    }
    
    try:
        response = requests.post(url, json=body, headers=headers, timeout=15)
        response.raise_for_status()
        res_json = response.json()
        text = res_json["candidates"][0]["content"]["parts"][0]["text"]
        
        # Parse output
        title = "Enterprise Systems Developer"
        department = "Engineering"
        criteria = "Python, REST APIs, Git"
        description = text
        
        if "---" in text:
            parts = text.split("---")
            content_part = parts[1] if len(parts) > 1 else text
            
            lines = content_part.strip().split("\n")
            desc_lines = []
            is_desc = False
            
            for line in lines:
                if line.startswith("TITLE:"):
                    title = line.replace("TITLE:", "").strip()
                elif line.startswith("DEPARTMENT:"):
                    department = line.replace("DEPARTMENT:", "").strip()
                elif line.startswith("CRITERIA:"):
                    criteria = line.replace("CRITERIA:", "").strip()
                elif line.startswith("DESCRIPTION:"):
                    is_desc = True
                elif is_desc:
                    desc_lines.append(line)
                    
            if desc_lines:
                description = "\n".join(desc_lines).strip()
                
        return GenerateJdResponse(
            title=title,
            department=department,
            criteria=criteria,
            description=description,
            threshold_score=80
        )
    except Exception as e:
        print(f"Gemini API request failed, falling back. Error: {e}")
        try:
            diag_res = requests.get(f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}", timeout=5)
            print(f"DIAGNOSTIC - GET /models Status: {diag_res.status_code}")
            print(f"DIAGNOSTIC - GET /models Response: {diag_res.text[:1000]}")
        except Exception as diag_err:
            print(f"DIAGNOSTIC - Failed to query models endpoint: {diag_err}")
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


@router.post("/offers", response_model=OfferLetterResponse, status_code=status.HTTP_201_CREATED)
async def create_offer(
    payload: OfferLetterCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:hrms"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    applicant = await db.get(Applicant, payload.applicant_id)
    if not applicant or applicant.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Applicant profile not found")

    new_offer = OfferLetter(
        tenant_id=ctx.tenant_id,
        applicant_id=payload.applicant_id,
        candidate=applicant.name,
        role=applicant.job_title,
        ctc=payload.ctc,
        offer_date=date.today(),
        expiry_date=payload.expiry_date,
        joining_date=payload.joining_date,
        signer_name=payload.signer_name,
        status="Awaiting Acceptance",
        custom_template=payload.custom_template,
    )
    db.add(new_offer)
    await db.commit()
    await db.refresh(new_offer)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="hrms_recruitment",
        action="create_offer_letter",
        entity_type="OfferLetter",
        entity_id=new_offer.id,
        new_values={"candidate": applicant.name, "role": applicant.job_title, "ctc": payload.ctc},
    )
    await db.commit()
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
    applicant = await db.get(Applicant, offer.applicant_id)
    if not applicant:
         raise HTTPException(status_code=404, detail="Candidate applicant not found")

    # Dispatch email
    email_body = (
        f"Dear {offer.candidate},\n\n"
        f"We are pleased to extend this formal offer of employment to join Nimbus Retail Group as a {offer.role}.\n\n"
        f"Offer Terms:\n"
        f"- Compensation: ${offer.ctc:,.2f} per annum\n"
        f"- Target Start Date: {offer.joining_date}\n"
        f"- Offer Expiration: {offer.expiry_date}\n\n"
    )
    if offer.custom_template:
        email_body += f"{offer.custom_template}\n\n"
    email_body += f"Sincerely,\n{offer.signer_name}\nHuman Resources Department\nNimbus Retail Group"

    await send_recruitment_email(applicant.email, f"Employment Offer: {offer.role} - Nimbus Retail", email_body)

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
        new_values={"recipient_candidate": offer.candidate, "signer": offer.signer_name},
    )
    await db.commit()
    return {"status": "ok", "message": f"Email successfully dispatched to candidate '{offer.candidate}'."}


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
            
            stmt = select(OnboardingRecord).where(
                and_(
                    OnboardingRecord.tenant_id == ctx.tenant_id,
                    OnboardingRecord.applicant_id == offer.applicant_id
                )
            )
            existing = await db.scalar(stmt)
            
            if not existing:
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
