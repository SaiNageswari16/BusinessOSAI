"""
FIT CLUB AI — Super Admin Router Endpoints
Serves platform overview, gym management, device monitoring, AI engine telemetry,
and DB-driven feature control matrix endpoints.
"""
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from src.database.session import get_db
from src.services.super_admin_service import SuperAdminService

router = APIRouter(prefix="/superadmin", tags=["Super Admin"])


@router.get("/overview")
@router.get("/super-admin/overview")
def get_super_admin_overview(db: Session = Depends(get_db)):
    return SuperAdminService.get_platform_overview(db)


@router.get("/gyms")
@router.get("/organizations")
def list_organizations(db: Session = Depends(get_db)):
    """Fetch all Gym branches and owners dynamically from PostgreSQL DB."""
    return SuperAdminService.get_organizations(db)


@router.get("/organizations/{org_id}")
def get_organization_detail(org_id: str, db: Session = Depends(get_db)):
    """Fetch deep inspection details for a single organization."""
    detail = SuperAdminService.get_organization_detail(db, org_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Organization not found")
    return detail


@router.post("/gyms")
@router.post("/organizations")
def onboard_organization(payload: dict = Body(...), db: Session = Depends(get_db)):
    """Onboard a new Gym branch and owner dynamically into PostgreSQL DB."""
    return SuperAdminService.onboard_gym(db, payload)


@router.patch("/gyms/{gym_id}/status")
@router.patch("/organizations/{gym_id}/status")
def update_organization_status(gym_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    """Approve or Suspend an Organization in PostgreSQL DB."""
    status = payload.get("status") or "active"
    return SuperAdminService.update_gym_status(db, gym_id, status)


@router.get("/users")
def list_global_users(db: Session = Depends(get_db)):
    """Fetch all platform users dynamically from DB."""
    return SuperAdminService.get_global_users(db)


@router.get("/plans")
def list_plans(db: Session = Depends(get_db)):
    """Fetch all SaaS subscription plans dynamically from DB."""
    return SuperAdminService.get_plans(db)


@router.post("/plans")
def create_plan(payload: dict = Body(...), db: Session = Depends(get_db)):
    """Create a new SaaS subscription tier dynamically in PostgreSQL."""
    return SuperAdminService.create_saas_plan(db, payload)


@router.get("/support-tickets")
def list_support_tickets(status: str = None, db: Session = Depends(get_db)):
    """Fetch platform support tickets dynamically from DB."""
    return SuperAdminService.get_support_tickets(db, status_filter=status)


@router.post("/support-tickets")
def create_support_ticket(payload: dict = Body(...), db: Session = Depends(get_db)):
    """Create a support ticket directly in PostgreSQL DB."""
    return SuperAdminService.create_support_ticket(db, payload)


@router.patch("/support-tickets/{ticket_id}/status")
def update_support_ticket_status(ticket_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    """Update support ticket status directly in DB."""
    status = payload.get("status") or "resolved"
    return SuperAdminService.update_support_ticket_status(db, ticket_id, status)



@router.get("/billing/overview")
def get_billing_overview(db: Session = Depends(get_db)):
    """Fetch revenue, MRR, and transaction history dynamically from DB."""
    return SuperAdminService.get_billing_overview(db)


@router.get("/devices")
def list_devices(db: Session = Depends(get_db)):
    """Fetch all hardware devices directly from BiometricDevice table."""
    return SuperAdminService.get_devices(db)


@router.post("/devices")
def register_device(payload: dict = Body(...), db: Session = Depends(get_db)):
    """Register a new hardware device dynamically into DB."""
    return SuperAdminService.register_new_device(db, payload)


@router.post("/devices/ping/{device_id}")
def ping_device(device_id: str, db: Session = Depends(get_db)):
    """Pings a device and refreshes heartbeat status in DB."""
    try:
        return SuperAdminService.ping_device(db, device_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/devices/{device_id}")
def delete_device(device_id: str, db: Session = Depends(get_db)):
    """Decommission and remove a hardware device from DB."""
    try:
        return SuperAdminService.delete_device(db, device_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/ai-modules")
@router.get("/ai/overview")
def list_ai_modules(db: Session = Depends(get_db)):
    """Fetch real AI engine telemetry and module metrics from PostgreSQL."""
    return SuperAdminService.get_ai_platform_overview(db)


@router.post("/ai/model-routing")
@router.post("/ai-modules/routing")
def update_ai_model_routing(payload: dict = Body(...), db: Session = Depends(get_db)):
    """Update active model routing for a specific capability in DB."""
    try:
        return SuperAdminService.update_ai_model_routing(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/ai/test-job")
@router.post("/ai-modules/test-job")
def run_test_ai_job(payload: dict = Body(default={}), db: Session = Depends(get_db)):
    """Run a live test inference and log telemetry directly into DB."""
    return SuperAdminService.run_test_ai_job(db, payload)



@router.get("/audit-logs")
def get_audit_logs(db: Session = Depends(get_db)):
    """Fetch platform audit logs dynamically from DB."""
    return SuperAdminService.get_audit_logs(db)


@router.get("/settings")
def get_settings(db: Session = Depends(get_db)):
    """Fetch platform settings dynamically from DB."""
    return SuperAdminService.get_platform_settings(db)


@router.get("/feature-controls")
def get_feature_controls(db: Session = Depends(get_db)):
    """Retrieve Plan Feature Control matrix directly from PostgreSQL feature_controls table."""
    return SuperAdminService.get_feature_controls(db)


@router.post("/feature-controls")
def save_feature_controls(payload: dict = Body(...), db: Session = Depends(get_db)):
    """Save updated Plan Feature Control matrix into PostgreSQL feature_controls table."""
    return SuperAdminService.save_feature_controls(db, payload)


@router.get("/nutrition-policies")
def get_nutrition_policies(db: Session = Depends(get_db)):
    """Fetch all nutrition goal policy rules directly from PostgreSQL nutrition_goal_policies DB table."""
    return SuperAdminService.get_nutrition_policies(db)


@router.post("/nutrition-policies")
def save_nutrition_policy(payload: dict = Body(...), db: Session = Depends(get_db)):
    """Create or update a nutrition goal policy rule directly in PostgreSQL DB."""
    return SuperAdminService.save_nutrition_policy(db, payload)

