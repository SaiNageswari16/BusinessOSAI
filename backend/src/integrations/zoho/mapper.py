from typing import Any, Dict
from src.models import JobOpening, Applicant, Interview

class ZohoMapper:
    """
    Utility class to map local database models to Zoho Recruit API payload formats
    and vice versa.
    """
    
    @staticmethod
    def markdown_to_html(md: str) -> str:
        """Helper to convert Markdown formatted text into HTML for Zoho's rich-text fields."""
        if not md:
            return ""
        import re
        # Convert bold and italics
        html = re.sub(r"\*\*(.*?)\*\*", r"<strong>\1</strong>", md)
        html = re.sub(r"\*(.*?)\*", r"<em>\1</em>", html)
        
        lines = html.split("\n")
        formatted_lines = []
        in_list = False
        
        for line in lines:
            stripped = line.strip()
            if not stripped:
                if in_list:
                    formatted_lines.append("</ul>")
                    in_list = False
                formatted_lines.append("<br/>")
                continue
                
            # Headers
            if stripped.startswith("# "):
                if in_list:
                    formatted_lines.append("</ul>")
                    in_list = False
                formatted_lines.append(f"<h1>{stripped[2:]}</h1>")
            elif stripped.startswith("## "):
                if in_list:
                    formatted_lines.append("</ul>")
                    in_list = False
                formatted_lines.append(f"<h2>{stripped[3:]}</h2>")
            elif stripped.startswith("### "):
                if in_list:
                    formatted_lines.append("</ul>")
                    in_list = False
                formatted_lines.append(f"<h3>{stripped[4:]}</h3>")
            # Bullet list items
            elif stripped.startswith("- ") or stripped.startswith("* "):
                if not in_list:
                    formatted_lines.append("<ul>")
                    in_list = True
                formatted_lines.append(f"<li>{stripped[2:]}</li>")
            else:
                if in_list:
                    formatted_lines.append("</ul>")
                    in_list = False
                formatted_lines.append(f"<p>{stripped}</p>")
                
        if in_list:
            formatted_lines.append("</ul>")
            
        return "\n".join(formatted_lines)

    @staticmethod
    def map_job_to_zoho(job: JobOpening) -> Dict[str, Any]:
        """Maps local JobOpening model field keys to Zoho Recruit JobOpening schema."""
        # Convert raw Markdown description into HTML for Zoho Recruit's rich text editor
        html_desc = ZohoMapper.markdown_to_html(job.description)
        return {
            "Posting_Title": job.title,
            "Job_Opening_Name": job.title,       # Zoho Recruit mandatory field name in some accounts
            "Department": job.department,
            "City": job.location,
            "Job_Description": html_desc,
            "Number_of_Positions": job.openings,
            "Required_Work_Experience": job.experience,
            "Job_Type": job.type,
            "Industry": "Technology",
            "Job_Opening_Status": "In-progress"  # Default active status in Zoho Recruit
        }

    @staticmethod
    def map_applicant_to_zoho(applicant: Applicant) -> Dict[str, Any]:
        """Maps local Applicant model fields to Zoho Recruit Candidate schema."""
        # Simple First Name / Last Name parsing
        name_parts = (applicant.name or "").split(" ", 1)
        first_name = name_parts[0] if name_parts else "Candidate"
        last_name = name_parts[1] if len(name_parts) > 1 else "."

        return {
            "First_Name": first_name,
            "Last_Name": last_name,
            "Email": applicant.email,
            "Experience_in_Years": applicant.experience,
            "Candidate_Status": applicant.stage
        }

    @staticmethod
    def map_zoho_to_job_dict(zoho_job: Dict[str, Any]) -> Dict[str, Any]:
        """Maps Zoho Recruit JobOpening fields back to local database dictionary format."""
        return {
            "title": zoho_job.get("Job_Opening_Name") or zoho_job.get("Posting_Title", "Untitled Job"),
            "department": zoho_job.get("Department", "Engineering"),
            "location": zoho_job.get("City", "Remote"),
            "description": zoho_job.get("Job_Description", ""),
            "openings": int(zoho_job.get("Number_of_Positions") or 1),
            "experience": zoho_job.get("Required_Work_Experience", "Entry Level"),
            "type": zoho_job.get("Job_Type", "Full-Time"),
            "status": "Open" if zoho_job.get("Job_Opening_Status") in ["In-progress", "Approved"] else "Closed",
            "criteria": "Software"  # Default criteria if mapping from external
        }

    @staticmethod
    def map_zoho_to_applicant_dict(zoho_candidate: Dict[str, Any]) -> Dict[str, Any]:
        """Maps Zoho Recruit Candidate fields back to local database dictionary format."""
        first = zoho_candidate.get("First_Name") or ""
        last = zoho_candidate.get("Last_Name") or ""
        fullname = f"{first} {last}".strip() or "Unknown Candidate"
        
        return {
            "name": fullname,
            "email": zoho_candidate.get("Email", ""),
            "experience": zoho_candidate.get("Experience_in_Years", "0"),
            "stage": zoho_candidate.get("Candidate_Status", "Applied"),
            "source": "Zoho Recruit Sync"
        }
