from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from src.database.session import get_db
from src.services.gym_setting_service import GymSettingService

router = APIRouter(prefix="/gym", tags=["Gym Branches & Settings"])

@router.get("/branches")
def get_gym_branches(db: Session = Depends(get_db)):
    return GymSettingService.get_all_branches(db)

@router.post("/branches")
def create_gym_branch(payload: dict = Body(...), db: Session = Depends(get_db)):
    if not payload.get("branch_name"):
        raise HTTPException(status_code=400, detail="branch_name is required")
    branch = GymSettingService.create_branch(db, payload)
    return {"message": "Branch created successfully", "branch": {
        "id": branch.id,
        "gym_name": branch.gym_name,
        "branch_name": branch.branch_name,
        "city": branch.city,
    }}

@router.get("/settings")
def get_gym_settings(db: Session = Depends(get_db)):
    setting = GymSettingService.get_settings(db)
    return {
        "gym_name": setting.gym_name,
        "phone": setting.phone,
        "gstin": setting.gstin,
        "essl_bioserver_url": setting.essl_bioserver_url,
        "enable_auto_sms": setting.enable_auto_sms,
        "enable_gate_autolock": setting.enable_gate_autolock,
        "enable_pos": setting.enable_pos if setting.enable_pos is not None else True,
        "enable_inventory": setting.enable_inventory if setting.enable_inventory is not None else True,
    }

@router.post("/settings")
def update_gym_settings(payload: dict = Body(...), db: Session = Depends(get_db)):
    setting = GymSettingService.update_settings(db, payload)
    return {
        "message": "Gym settings updated successfully",
        "settings": {
            "gym_name": setting.gym_name,
            "phone": setting.phone,
            "gstin": setting.gstin,
            "essl_bioserver_url": setting.essl_bioserver_url,
            "enable_auto_sms": setting.enable_auto_sms,
            "enable_gate_autolock": setting.enable_gate_autolock,
            "enable_pos": setting.enable_pos if setting.enable_pos is not None else True,
            "enable_inventory": setting.enable_inventory if setting.enable_inventory is not None else True,
        }
    }
