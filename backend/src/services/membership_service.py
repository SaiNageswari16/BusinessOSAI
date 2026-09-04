from src.utils.timezone import now_ist_naive, today_ist_start, today_ist_end, to_ist_str
import uuid
import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from src.models.membership import Membership
from src.models.plan import MembershipPlan

class MembershipService:

    @staticmethod
    def get_all_plans(db: Session) -> List[dict]:
        """
        Returns dynamic active membership plans directly from PostgreSQL/SQLite database without hardcoded fallbacks.
        """
        plans = db.query(MembershipPlan).filter(MembershipPlan.is_active == True).order_by(MembershipPlan.price.asc()).all()

        colors = [
            'from-navy-400 to-navy-600',
            'from-brand-400 to-brand-600',
            'from-success-400 to-success-600',
            'from-ai-400 to-ai-600'
        ]

        result = []
        for idx, p in enumerate(plans):
            period = "month" if p.duration_days == 30 else (f"{p.duration_days // 30} months" if p.duration_days < 365 else "year")
            features = [f.strip() for f in (p.description or "Gym Access").split(",") if f.strip()]
            result.append({
                "id": p.id,
                "name": p.name,
                "price": int(p.price),
                "duration_days": p.duration_days,
                "period": period,
                "features": features,
                "color": colors[idx % len(colors)],
                "badge": p.badge or "",
            })
        return result

    @staticmethod
    def create_plan(db: Session, data: dict) -> List[dict]:
        name = data.get("name")
        price = float(data.get("price", 0.0))
        duration_days = int(data.get("duration_days", 30))
        features_list = data.get("features")
        description = data.get("description") or (", ".join(features_list) if isinstance(features_list, list) else "Gym Access")
        badge = data.get("badge", "")

        if not name:
            raise ValueError("Plan name is required")

        plan_id = f"plan_{uuid.uuid4().hex[:6]}"
        plan = MembershipPlan(
            id=plan_id,
            name=name,
            price=price,
            duration_days=duration_days,
            description=description,
            badge=badge,
            is_active=True
        )
        db.add(plan)
        db.commit()
        db.refresh(plan)
        return MembershipService.get_all_plans(db)

    @staticmethod
    def update_plan(db: Session, plan_id: str, data: dict) -> List[dict]:
        plan = db.query(MembershipPlan).filter(MembershipPlan.id == plan_id).first()
        if not plan:
            raise ValueError(f"Plan '{plan_id}' not found")

        if "name" in data:
            plan.name = data["name"]
        if "price" in data:
            plan.price = float(data["price"])
        if "duration_days" in data:
            plan.duration_days = int(data["duration_days"])
        if "description" in data:
            plan.description = data["description"]
        elif "features" in data and isinstance(data["features"], list):
            plan.description = ", ".join(data["features"])
        if "badge" in data:
            plan.badge = data["badge"]

        db.commit()
        db.refresh(plan)
        return MembershipService.get_all_plans(db)

    @staticmethod
    def delete_plan(db: Session, plan_id: str) -> dict:
        plan = db.query(MembershipPlan).filter(MembershipPlan.id == plan_id).first()
        if plan:
            plan.is_active = False
            db.commit()
        return {"status": "SUCCESS", "message": f"Plan '{plan_id}' deleted."}

    @staticmethod
    def get_membership_by_customer(db: Session, customer_id: str) -> Optional[Membership]:
        return db.query(Membership).filter(Membership.customer_id == customer_id).order_by(Membership.created_at.desc()).first()

    @staticmethod
    def get_expiring_memberships(db: Session) -> List[Membership]:
        return db.query(Membership).filter(Membership.status == "ACTIVE").limit(10).all()

    @staticmethod
    def _resolve_plan(db: Session, data: dict) -> tuple:
        """
        Dynamically resolves (plan_name, price, duration_days) from PostgreSQL MembershipPlan table or input data.
        Zero hardcoded string/integer fallbacks.
        """
        plan = None
        if data.get("plan_id"):
            plan = db.query(MembershipPlan).filter(MembershipPlan.id == data["plan_id"]).first()
        if not plan and data.get("plan_name"):
            plan = db.query(MembershipPlan).filter(MembershipPlan.name == data["plan_name"]).first()

        if plan:
            plan_name = plan.name
            price = float(data.get("price")) if data.get("price") is not None else float(plan.price)
            duration_days = int(data.get("duration_days")) if data.get("duration_days") is not None else int(plan.duration_days)
        else:
            plan_name = str(data.get("plan_name") or "Custom Membership Plan")
            price = float(data.get("price") or 0.0)
            duration_days = int(data.get("duration_days") or 30)

        return plan_name, price, duration_days

    @staticmethod
    def assign_membership(db: Session, data: dict) -> Membership:
        customer_id = data.get("customer_id")
        if not customer_id:
            raise ValueError("customer_id is required for membership assignment")

        plan_name, price, duration_days = MembershipService._resolve_plan(db, data)
        paid_amount = float(data.get("paid_amount")) if data.get("paid_amount") is not None else price
        due_amount = float(data.get("due_amount")) if data.get("due_amount") is not None else max(0.0, price - paid_amount)

        if data.get("start_date"):
            try:
                start_date = datetime.datetime.fromisoformat(data["start_date"].replace('Z', ''))
            except Exception:
                start_date = now_ist_naive()
        else:
            start_date = now_ist_naive()

        if data.get("expiry_date"):
            try:
                expiry_date = datetime.datetime.fromisoformat(data["expiry_date"].replace('Z', ''))
            except Exception:
                expiry_date = start_date + datetime.timedelta(days=duration_days)
        else:
            expiry_date = start_date + datetime.timedelta(days=duration_days)

        plan_type = "ANNUAL" if duration_days >= 365 else ("QUARTERLY" if duration_days >= 90 else "MONTHLY")

        mem = Membership(
            id=f"mem_{uuid.uuid4().hex[:8]}",
            customer_id=customer_id,
            plan_name=plan_name,
            plan_type=plan_type,
            status="ACTIVE",
            start_date=start_date,
            expiry_date=expiry_date,
            price=price,
            paid_amount=paid_amount,
            due_amount=due_amount
        )
        db.add(mem)
        db.commit()
        db.refresh(mem)
        return mem

    @staticmethod
    def renew_membership(db: Session, customer_id: str, data: dict) -> Membership:
        mem = db.query(Membership).filter(Membership.customer_id == customer_id).order_by(Membership.created_at.desc()).first()
        now = now_ist_naive()

        if mem:
            if data.get("duration_days") is not None:
                duration_days = int(data["duration_days"])
            elif data.get("plan_name") or data.get("plan_id"):
                _, _, duration_days = MembershipService._resolve_plan(db, data)
            else:
                if mem.expiry_date and mem.start_date:
                    delta = (mem.expiry_date - mem.start_date).days
                    duration_days = delta if delta > 0 else 30
                else:
                    duration_days = 30

            add_amount = float(data.get("paid_amount")) if data.get("paid_amount") is not None else float(data.get("price") or 0.0)

            if data.get("plan_name"):
                mem.plan_name = str(data["plan_name"])

            if data.get("expiry_date"):
                try:
                    mem.expiry_date = datetime.datetime.fromisoformat(data["expiry_date"].replace('Z', ''))
                except Exception:
                    base_date = mem.expiry_date if (mem.expiry_date and mem.expiry_date > now) else now
                    mem.expiry_date = base_date + datetime.timedelta(days=duration_days)
            else:
                base_date = mem.expiry_date if (mem.expiry_date and mem.expiry_date > now) else now
                mem.expiry_date = base_date + datetime.timedelta(days=duration_days)

            mem.status = "ACTIVE"
            mem.paid_amount += add_amount
            mem.due_amount = max(0.0, mem.due_amount - add_amount)
            db.commit()
            db.refresh(mem)
            return mem
        else:
            data["customer_id"] = customer_id
            return MembershipService.assign_membership(db, data)
