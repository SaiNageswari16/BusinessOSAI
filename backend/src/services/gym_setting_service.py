import uuid
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from src.models.gym_setting import GymBranch, GymSetting, PaymentMethod
from src.models.customer import Customer
from src.models.biometric_device import BiometricDevice

class GymSettingService:

    @staticmethod
    def get_all_branches(db: Session) -> List[Dict[str, Any]]:
        """
        Returns all registered gym branches from PostgreSQL database without hardcoded seed fallbacks.
        """
        branches = db.query(GymBranch).filter(GymBranch.is_active == True).all()

        # If no explicit GymBranch entries, derive dynamically from Customer primary_gym_location
        if not branches:
            distinct_locs = (
                db.query(Customer.primary_gym_location)
                .filter(Customer.primary_gym_location.isnot(None))
                .distinct()
                .all()
            )
            for loc_tuple in distinct_locs:
                loc = loc_tuple[0]
                if loc:
                    parts = loc.split("·")
                    b_name = parts[0].strip()
                    c_name = parts[1].strip() if len(parts) > 1 else ""
                    b_id = f"branch_{uuid.uuid4().hex[:6]}"
                    new_b = GymBranch(id=b_id, gym_name=settings.GYM_NAME, branch_name=b_name, city=c_name)
                    db.add(new_b)
            db.commit()
            branches = db.query(GymBranch).filter(GymBranch.is_active == True).all()

        result = []
        for b in branches:
            member_count = db.query(Customer).filter(Customer.primary_gym_location.ilike(f"%{b.branch_name}%")).count()
            device_count = db.query(BiometricDevice).filter(BiometricDevice.location.ilike(f"%{b.branch_name}%")).count()

            result.append({
                "id": b.id,
                "gym_name": b.gym_name,
                "branch_name": b.branch_name,
                "city": b.city or "",
                "address": b.address or (f"{b.branch_name}, {b.city}" if b.city else b.branch_name),
                "active_members": member_count,
                "devices_count": device_count,
                "status": "ONLINE" if device_count > 0 else "ACTIVE"
            })
        return result

    @staticmethod
    def create_branch(db: Session, data: Dict[str, Any]) -> GymBranch:
        from src.config.settings import settings
        branch_id = f"branch_{uuid.uuid4().hex[:6]}"
        b = GymBranch(
            id=branch_id,
            gym_name=data.get("gym_name") or settings.GYM_NAME,
            branch_name=data["branch_name"],
            city=data.get("city") or "",
            address=data.get("address")
        )
        db.add(b)
        db.commit()
        db.refresh(b)
        return b

    @staticmethod
    def get_settings(db: Session) -> GymSetting:
        setting = db.query(GymSetting).filter(GymSetting.id == "default").first()
        if not setting:
            setting = GymSetting(
                id="default",
                gym_name="",
                phone="",
                gstin="",
                essl_bioserver_url="",
                enable_auto_sms=True,
                enable_gate_autolock=True,
                enable_pos=True,
                enable_inventory=True
            )
            db.add(setting)
            db.commit()
            db.refresh(setting)
        return setting

    @staticmethod
    def update_settings(db: Session, data: Dict[str, Any]) -> GymSetting:
        setting = db.query(GymSetting).filter(GymSetting.id == "default").first()
        if not setting:
            setting = GymSetting(id="default")
            db.add(setting)

        setting.gym_name = data.get("gym_name", "")
        setting.phone = data.get("phone", "")
        setting.gstin = data.get("gstin", "")
        setting.essl_bioserver_url = data.get("essl_bioserver_url", "")
        if "enable_auto_sms" in data:
            setting.enable_auto_sms = bool(data["enable_auto_sms"])
        if "enable_gate_autolock" in data:
            setting.enable_gate_autolock = bool(data["enable_gate_autolock"])
        if "enable_pos" in data:
            setting.enable_pos = bool(data["enable_pos"])
        if "enable_inventory" in data:
            setting.enable_inventory = bool(data["enable_inventory"])

        db.commit()
        db.refresh(setting)
        return setting

    @staticmethod
    def get_payment_methods(db: Session) -> List[PaymentMethod]:
        """
        Returns active payment methods dynamically from PostgreSQL database.
        100% dynamic without any hardcoded seed lists.
        """
        return (
            db.query(PaymentMethod)
            .filter(PaymentMethod.is_active == True)
            .order_by(PaymentMethod.created_at.asc())
            .all()
        )

    @staticmethod
    def add_payment_method(db: Session, data: Dict[str, Any]) -> PaymentMethod:
        pm_name = data["name"].strip()
        existing = db.query(PaymentMethod).filter(PaymentMethod.name.ilike(pm_name)).first()
        if existing:
            existing.is_active = True
            db.commit()
            db.refresh(existing)
            return existing
        pm_id = f"pm_{uuid.uuid4().hex[:6]}"
        new_pm = PaymentMethod(
            id=pm_id,
            name=pm_name,
            code=data.get("code") or pm_name.upper().replace(" ", "_"),
            icon=data.get("icon") or "credit-card",
            is_active=True
        )
        db.add(new_pm)
        db.commit()
        db.refresh(new_pm)
        return new_pm
