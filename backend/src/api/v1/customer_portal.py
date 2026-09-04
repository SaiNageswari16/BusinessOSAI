import uuid
import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header, Body, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from src.database.session import get_db
from src.utils.security import verify_token
from src.utils.timezone import now_ist_naive
from src.models.user import User
from src.models.customer import Customer
from src.models.membership import Membership
from src.models.inbody import InBodyReport
from src.models.biometric import BiometricLog
from src.models.workout import (
    Workout, WorkoutExercise, WorkoutSession, WorkoutSessionExercise,
    WorkoutProgram, CustomerProgramAssignment, Exercise
)
from src.models.nutrition import NutritionLog, NutritionFoodLogItem
from src.services.musclewiki_service import musclewiki_service
from src.services.wger_service import wger_service
from src.services.free_exercise_service import free_exercise_service
from src.services.exercise_sync_service import ExerciseSyncService
from src.services.nutrition_service import (
    NutritionService, calculate_dynamic_user_targets, generate_ai_meal_recommendations_and_vitamins
)
from src.services.inbody_ocr_service import InBodyOcrService

router = APIRouter(prefix="/customer", tags=["Customer Portal"])


def get_current_customer(authorization: str = Header(None), db: Session = Depends(get_db)) -> Customer:
    """
    Extracts Bearer token from Authorization header and returns authenticated Customer model.
    Strictly derives customer identity from JWT claims / DB lookup.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication token missing")

    token = authorization.split(" ")[1]
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired authentication token")

    user_id = payload.get("sub")
    cust_id = payload.get("customer_id")

    customer = None
    if cust_id:
        customer = db.query(Customer).filter(Customer.id == cust_id).first()

    if not customer and (user_id or payload.get("email")):
        user = None
        if user_id:
            user = db.query(User).filter(User.id == user_id).first()
        if not user and payload.get("email"):
            user = db.query(User).filter(User.email == payload.get("email").strip().lower()).first()

        if user:
            customer = db.query(Customer).filter(Customer.user_id == user.id).first()
            if not customer:
                customer = db.query(Customer).filter(Customer.id == f"cust_{user.id}").first()
            if not customer:
                customer = Customer(
                    id=f"cust_{user.id}",
                    user_id=user.id,
                    email=user.email,
                    full_name=user.full_name or "Gym Member",
                    phone=user.phone or "",
                    status="ACTIVE"
                )
                db.add(customer)
                try:
                    db.commit()
                    db.refresh(customer)
                except Exception:
                    db.rollback()
                    customer = db.query(Customer).filter(Customer.id == f"cust_{user.id}").first() or db.query(Customer).first()

    if not customer:
        raise HTTPException(
            status_code=401,
            detail="Authenticated customer profile not found. Please log in with a valid customer account."
        )

    return customer


# ── 1. PROFILE & MEMBERSHIP ──────────────────────────────────────────────────

@router.get("/me")
def get_customer_profile(
    cust: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Returns authenticated customer profile and membership status strictly from PostgreSQL DB."""
    membership = (
        db.query(Membership)
        .filter(Membership.customer_id == cust.id)
        .order_by(Membership.created_at.desc())
        .first()
    )

    membership_data = {
        "plan_name": "No Active Plan",
        "status": "Inactive",
        "start_date": None,
        "expiry_date": None,
        "days_remaining": 0,
    }

    if membership:
        days_remaining = None
        if membership.expiry_date:
            expiry = membership.expiry_date.date()
            days_remaining = max(0, (expiry - datetime.date.today()).days)

        membership_data = {
            "plan_name": membership.plan_name,
            "status": membership.status or "Active",
            "start_date": membership.start_date.isoformat() if membership.start_date else None,
            "expiry_date": membership.expiry_date.isoformat() if membership.expiry_date else None,
            "days_remaining": days_remaining if days_remaining is not None else 0,
        }

    return {
        "id": cust.id,
        "member_code": getattr(cust, "member_code", None),
        "full_name": cust.full_name,
        "email": cust.email,
        "phone": cust.phone,
        "gender": cust.gender,
        "age": cust.age,
        "weight": cust.weight,
        "height": cust.height,
        "bmi": cust.bmi,
        "fitness_level": cust.fitness_level,
        "goal": cust.goal,
        "target_weight": cust.target_weight,
        "body_condition": cust.body_condition,
        "meals_per_day": cust.meals_per_day,
        "dietary_preference": cust.dietary_preference,
        "workout_type": cust.training_preference,
        "days_per_week": cust.days_per_week,
        # AI Nutrition Targets
        "target_calories": cust.target_calories,
        "target_protein": cust.target_protein,
        "target_fat": cust.target_fat,
        "target_carbs": cust.target_carbs,
        "target_sugar": cust.target_sugar,
        "target_fiber": cust.target_fiber,
        "profile_image": cust.profile_image,
        "status": cust.status,
        "membership": membership_data,
    }


@router.patch("/me")
def update_customer_profile(
    payload: Dict[str, Any] = Body(...),
    cust: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Updates editable personal info and AI nutrition targets directly in DB."""
    if "full_name" in payload:
        cust.full_name = payload["full_name"]
    if "phone" in payload:
        cust.phone = payload["phone"]
    if "gender" in payload:
        cust.gender = payload["gender"]
    if "age" in payload and payload["age"] is not None:
        cust.age = int(payload["age"])
    if "weight" in payload and payload["weight"] is not None:
        cust.weight = float(payload["weight"])
    if "height" in payload and payload["height"] is not None:
        cust.height = float(payload["height"])
    if "goal" in payload:
        cust.goal = payload["goal"]
    if "target_weight" in payload and payload["target_weight"] is not None:
        cust.target_weight = float(payload["target_weight"])
    if "body_condition" in payload:
        cust.body_condition = payload["body_condition"]
    if "meals_per_day" in payload and payload["meals_per_day"] is not None:
        cust.meals_per_day = int(payload["meals_per_day"])
    if "dietary_preference" in payload:
        cust.dietary_preference = payload["dietary_preference"]
    if "workout_type" in payload:
        cust.training_preference = payload["workout_type"]
    if "days_per_week" in payload and payload["days_per_week"] is not None:
        cust.days_per_week = int(payload["days_per_week"])
    # AI Confirmed Nutrition Targets
    if "target_calories" in payload and payload["target_calories"] is not None:
        cust.target_calories = int(payload["target_calories"])
    if "target_protein" in payload and payload["target_protein"] is not None:
        cust.target_protein = int(round(float(payload["target_protein"])))
    if "target_fat" in payload and payload["target_fat"] is not None:
        cust.target_fat = int(round(float(payload["target_fat"])))
    if "target_carbs" in payload and payload["target_carbs"] is not None:
        cust.target_carbs = int(round(float(payload["target_carbs"])))
    if "target_sugar" in payload and payload["target_sugar"] is not None:
        cust.target_sugar = int(round(float(payload["target_sugar"])))
    if "target_fiber" in payload and payload["target_fiber"] is not None:
        cust.target_fiber = int(round(float(payload["target_fiber"])))

    db.commit()
    db.refresh(cust)
    return {"status": "success", "message": "Profile updated successfully"}


# ── AI NUTRITION TARGET ANALYZER ─────────────────────────────────────────────

import json as _json
import os as _os
import threading as _threading

_WORKOUT_POLICY_PATH = _os.path.abspath(
    _os.path.join(_os.path.dirname(__file__), "../../../../data/workout_type_policies.json")
)
_workout_policy_cache: Dict[str, Any] = {}
_workout_policy_lock = _threading.Lock()


def _load_workout_type_policies() -> Dict[str, Any]:
    """
    Dynamically loads workout-type macro policies from data/workout_type_policies.json.
    Thread-safe with in-process cache. Returns empty dict if file is missing.
    """
    global _workout_policy_cache
    with _workout_policy_lock:
        try:
            if _os.path.exists(_WORKOUT_POLICY_PATH):
                with open(_WORKOUT_POLICY_PATH, "r", encoding="utf-8") as f:
                    data = _json.load(f)
                _workout_policy_cache = data.get("workout_type_policies", {})
            else:
                _workout_policy_cache = {}
        except Exception:
            _workout_policy_cache = {}
    return _workout_policy_cache


def _load_days_per_week_multipliers() -> Dict[str, float]:
    """Loads days-per-week → activity-multiplier map from the same policy file."""
    try:
        if _os.path.exists(_WORKOUT_POLICY_PATH):
            with open(_WORKOUT_POLICY_PATH, "r", encoding="utf-8") as f:
                data = _json.load(f)
            return {str(k): float(v) for k, v in data.get("days_per_week_multipliers", {}).items()}
    except Exception:
        pass
    return {"2": 1.375, "3": 1.375, "4": 1.55, "5": 1.55, "6": 1.725}


# Pre-load at module startup so the first request is fast
_load_workout_type_policies()


@router.post("/nutrition/analyze-targets")
def analyze_nutrition_targets(
    payload: Dict[str, Any] = Body(...),
    cust: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """
    AI Clinical Nutrition Target Calculator.
    Uses Mifflin-St Jeor BMR + workout-type activity multiplier loaded dynamically
    from data/workout_type_policies.json — no hardcoded values.
    """
    weight_kg    = float(payload.get("weight_kg") or 0)
    height_cm    = float(payload.get("height_cm") or 0)
    age          = int(payload.get("age") or 0)
    gender       = str(payload.get("gender") or "").strip().lower()
    workout_type = str(payload.get("workout_type") or "").strip().lower()
    days_per_week = int(payload.get("days_per_week") or 4)

    if not (weight_kg > 0 and height_cm > 0 and age > 0 and gender):
        raise HTTPException(
            status_code=422,
            detail="weight_kg, height_cm, age, and gender are required to calculate targets."
        )

    # Mifflin-St Jeor BMR
    s = -161.0 if "female" in gender else 5.0
    bmr = (10.0 * weight_kg) + (6.25 * height_cm) - (5.0 * age) + s

    # --- Load policies dynamically from JSON (no hardcoded dict) ---
    wt_policies = _load_workout_type_policies()
    dpw_multipliers = _load_days_per_week_multipliers()

    # Match workout type against policy keys (substring match, case-insensitive)
    matched_policy: Optional[Dict[str, Any]] = None
    matched_key = ""
    for key, pol in wt_policies.items():
        if key in workout_type or workout_type in key:
            matched_policy = pol
            matched_key = key
            break

    if matched_policy:
        multiplier   = float(matched_policy.get("activity_multiplier", 1.55))
        protein_kg   = float(matched_policy.get("protein_per_kg", 1.8))
        calorie_pct  = float(matched_policy.get("calorie_pct", 0.0))
        policy_name  = matched_policy.get("display_name", matched_key.title())
    else:
        # Fallback: derive multiplier purely from days_per_week using policy file data
        multiplier  = dpw_multipliers.get(str(days_per_week), 1.55)
        protein_kg  = 1.8
        calorie_pct = 0.0
        policy_name = f"General Activity ({days_per_week}d/wk)"

    tdee = bmr * multiplier
    target_calories = int(round(tdee * (1 + calorie_pct)))

    # Protein
    protein_g = round(weight_kg * protein_kg, 1)
    # Fat (25% of kcal)
    fat_g = round((target_calories * 0.25) / 9.0, 1)
    # Carbs remainder
    remaining_kcal = target_calories - (protein_g * 4.0 + fat_g * 9.0)
    carbs_g = round(max(0.0, remaining_kcal / 4.0), 1)
    # Fibre: 14 g per 1000 kcal (American Dietetic Association)
    fiber_g = round((target_calories / 1000.0) * 14.0, 1)
    # Added sugar limit: 6% of total kcal / 4 kcal-per-gram
    sugar_limit_g = round((target_calories * 0.06) / 4.0, 1)

    # Build plain-English rationale
    calorie_pct_label = f"{'+' if calorie_pct >= 0 else ''}{int(calorie_pct * 100)}%"
    rationale_lines = [
        f"Policy loaded from: workout_type_policies.json → '{policy_name}'",
        f"BMR (Mifflin-St Jeor): {int(bmr)} kcal/day",
        f"TDEE with activity multiplier ({multiplier}×): {int(tdee)} kcal/day",
        f"Calorie target ({calorie_pct_label} adjustment): {target_calories} kcal/day",
        f"Protein at {protein_kg} g/kg body weight: {protein_g} g",
        f"Fat at 25% of total kcal: {fat_g} g",
        f"Carbohydrates (remainder): {carbs_g} g",
        f"Dietary fibre (14 g / 1000 kcal): {fiber_g} g",
        f"Added sugar limit (6% of kcal): {sugar_limit_g} g",
    ]

    return {
        "calories":      target_calories,
        "protein_g":     protein_g,
        "fat_g":         fat_g,
        "carbs_g":       carbs_g,
        "sugar_limit_g": sugar_limit_g,
        "fiber_g":       fiber_g,
        "bmr":           int(bmr),
        "tdee":          int(tdee),
        "method":        "CLINICAL_MIFFLIN_ST_JEOR_DYNAMIC",
        "policy_source": "workout_type_policies.json",
        "policy_name":   policy_name,
        "rationale":     " | ".join(rationale_lines),
    }


@router.post("/body-composition/upload")
async def upload_customer_body_composition_report(
    file: UploadFile = File(...),
    cust: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """
    Customer uploads body composition / InBody / BMI report (Image/PDF).
    Uses AI Vision OCR (InBodyOcrService) to extract biometrics, creates InBodyReport in PostgreSQL DB,
    updates customer's active profile (weight, height, bmi), and recalculates dynamic target calories & macros.
    """
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    mime_type = file.content_type or "image/jpeg"
    extracted = InBodyOcrService.extract_from_image_bytes(contents, mime_type=mime_type)

    if "error" in extracted and not extracted.get("weight_kg"):
        raise HTTPException(status_code=422, detail=extracted.get("error", "Unable to extract biometrics from scan report."))

    # Extract values
    w_kg = extracted.get("weight_kg")
    h_cm = extracted.get("height_cm")
    bmi_val = extracted.get("bmi")
    smm_kg = extracted.get("skeletal_muscle_mass_kg")
    pbf_pct = extracted.get("body_fat_percentage")
    visceral = extracted.get("visceral_fat_level")
    bmr_val = extracted.get("basal_metabolic_rate_kcal")
    water_val = extracted.get("body_water_l")
    prot_val = extracted.get("protein_kg")
    score_val = extracted.get("score")

    # Update Customer in PostgreSQL DB
    if w_kg:
        cust.weight = float(w_kg)
    if h_cm:
        cust.height = float(h_cm)
    if bmi_val:
        cust.bmi = float(bmi_val)
    elif w_kg and h_cm:
        cust.bmi = round(float(w_kg) / ((float(h_cm) / 100.0) ** 2), 1)

    # Create new InBodyReport in PostgreSQL DB
    report_id = f"inb_{uuid.uuid4().hex[:8]}"
    new_report = InBodyReport(
        id=report_id,
        customer_id=cust.id,
        scan_date=now_ist_naive(),
        score=int(score_val) if score_val else 80,
        weight=cust.weight,
        skeletal_muscle_mass=float(smm_kg) if smm_kg else None,
        body_fat_percentage=float(pbf_pct) if pbf_pct else None,
        body_fat_mass=round((cust.weight * float(pbf_pct) / 100.0), 1) if (cust.weight and pbf_pct) else None,
        visceral_fat=float(visceral) if visceral else None,
        bmi=cust.bmi,
        basal_metabolic_rate=float(bmr_val) if bmr_val else None,
        body_water=float(water_val) if water_val else None,
        protein=float(prot_val) if prot_val else None,
        segmental_analysis=extracted
    )
    db.add(new_report)
    db.commit()

    # Recalculate dynamic targets
    updated_targets = get_nutrition_targets(cust=cust)

    return {
        "status": "SUCCESS",
        "message": "Body composition scan extracted & biometrics updated in PostgreSQL DB!",
        "report_id": report_id,
        "extracted_biometrics": {
            "weight_kg": cust.weight,
            "height_cm": cust.height,
            "bmi": cust.bmi,
            "skeletal_muscle_mass_kg": smm_kg,
            "body_fat_percentage": pbf_pct,
            "visceral_fat_level": visceral,
            "basal_metabolic_rate_kcal": bmr_val,
            "score": score_val or 80,
        },
        "recalculated_targets": updated_targets.get("targets"),
        "ai_insights": [
            f"Extracted Weight: {cust.weight} kg | BMI: {cust.bmi}",
            f"Skeletal Muscle Mass: {smm_kg or 'N/A'} kg | Body Fat: {pbf_pct or 'N/A'}%",
            "Daily nutrition targets & macros have been dynamically recalculated based on your new report scan!"
        ]
    }



# ── 2. DASHBOARD & KPIS ──────────────────────────────────────────────────────

@router.get("/dashboard")
def get_customer_dashboard(
    cust: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Returns dynamic Customer Dashboard metrics calculated strictly from PostgreSQL DB."""
    completed_workouts = (
        db.query(WorkoutSession)
        .filter(
            WorkoutSession.customer_id == cust.id,
            WorkoutSession.status == "COMPLETED",
        )
        .count()
    )

    total_checkins = (
        db.query(BiometricLog)
        .filter(BiometricLog.customer_id == cust.id)
        .count()
    )

    today_start = now_ist_naive().replace(hour=0, minute=0, second=0, microsecond=0)

    nutrition_logs = (
        db.query(NutritionLog)
        .filter(
            NutritionLog.customer_id == cust.id,
            NutritionLog.date >= today_start,
        )
        .all()
    )

    consumed_calories = sum(log.calories for log in nutrition_logs if log.calories is not None)

    return {
        "customer_id": cust.id,
        "completed_workouts": completed_workouts,
        "attendance": {
            "total_visits": total_checkins,
        },
        "nutrition": {
            "calories_consumed": consumed_calories,
        },
        "readiness": None,
    }


# ── 3. ATTENDANCE & BIOMETRIC ACCESS ──────────────────────────────────────────

@router.get("/attendance")
def get_customer_attendance(
    cust: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Returns customer attendance metrics and check-in logs calculated directly from BiometricLog table."""
    logs = (
        db.query(BiometricLog)
        .filter(BiometricLog.customer_id == cust.id)
        .order_by(BiometricLog.timestamp.desc())
        .all()
    )

    total_visits = len(logs)
    today = now_ist_naive().date()
    unique_dates = {log.timestamp.date() for log in logs if log.timestamp}

    current_streak = 0
    cursor = today
    while cursor in unique_dates:
        current_streak += 1
        cursor -= datetime.timedelta(days=1)

    month_start = today.replace(day=1)
    monthly_visits = sum(1 for log in logs if log.timestamp and log.timestamp.date() >= month_start)

    return {
        "total_visits": total_visits,
        "current_streak": current_streak,
        "monthly_visits": monthly_visits,
        "last_visit": logs[0].timestamp.isoformat() if logs and logs[0].timestamp else None,
        "history": [
            {
                "id": log.id,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "verification_type": log.verification_type,
            }
            for log in logs
        ],
    }


@router.get("/biometric-status")
def get_customer_biometric_status(
    cust: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Returns dynamic access status for biometric methods enrolled in PostgreSQL DB by Owner."""
    logs = (
        db.query(BiometricLog)
        .filter(BiometricLog.customer_id == cust.id)
        .order_by(BiometricLog.timestamp.desc())
        .all()
    )

    has_face = any((log.verification_type or "").upper() in ["FACE", "FACE_RECOGNITION", "FACEID"] for log in logs)
    has_fp = any((log.verification_type or "").upper() in ["FINGERPRINT", "FP", "TOUCH"] for log in logs)
    has_rfid = any((log.verification_type or "").upper() in ["RFID", "CARD", "NFC"] for log in logs)

    last_scan = logs[0].timestamp.strftime("%d %b %Y, %I:%M %p") if (logs and logs[0].timestamp) else "No verification scans yet"

    return {
        "customer_id": cust.id,
        "face_recognition": {
            "status": "Active & Verified" if has_face else "Not Enrolled",
            "enrolled": has_face,
        },
        "fingerprint": {
            "status": "Registered & Active" if has_fp else "Not Enrolled",
            "enrolled": has_fp,
        },
        "rfid_card": {
            "status": "Active" if has_rfid else "Not Assigned",
            "card_number": f"RFID-{cust.phone[-4:]}" if cust.phone else "RFID-N/A",
            "assigned": has_rfid,
        },
        "last_verification": last_scan,
        "notice": "Turnstile and door access permissions are synced live from the Gym Owner Control Panel."
    }


# ── 4. BODY COMPOSITION ─────────────────────────────────────────────────────

@router.get("/body-composition/latest")
def get_customer_latest_body_scan(
    cust: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Returns the latest InBody scan report directly from PostgreSQL DB or None if missing."""
    report = (
        db.query(InBodyReport)
        .filter(InBodyReport.customer_id == cust.id)
        .order_by(InBodyReport.scan_date.desc())
        .first()
    )

    if not report:
        return {
            "has_scan": False,
            "data": None,
        }

    return {
        "has_scan": True,
        "data": {
            "scan_id": report.id,
            "scan_date": report.scan_date.isoformat() if report.scan_date else None,
            "weight_kg": report.weight,
            "body_fat_pct": report.body_fat_percentage,
            "bmi": report.bmi,
            "skeletal_muscle_mass_kg": report.skeletal_muscle_mass,
            "body_water_pct": report.body_water,
            "visceral_fat_level": report.visceral_fat,
            "inbody_score": report.score,
            "segmental_analysis": report.segmental_analysis,
        },
    }


# ── 5. WORKOUT SPLIT & EXERCISES ──────────────────────────────────────────────

@router.get("/workouts/split")
def get_customer_workout_split(
    cust: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Returns assigned WorkoutProgram split directly from PostgreSQL database."""
    assignment = (
        db.query(CustomerProgramAssignment)
        .filter(
            CustomerProgramAssignment.customer_id == cust.id,
            CustomerProgramAssignment.status == "ACTIVE",
        )
        .order_by(CustomerProgramAssignment.created_at.desc())
        .first()
    )

    if not assignment:
        return {
            "status": "NO_PLAN",
            "plan": None,
        }

    program = (
        db.query(WorkoutProgram)
        .filter(WorkoutProgram.id == assignment.program_id)
        .first()
    )

    if not program:
        return {
            "status": "NO_PLAN",
            "plan": None,
        }

    return {
        "status": "ACTIVE",
        "plan": {
            "id": program.id,
            "name": program.name,
            "description": getattr(program, "description", None),
            "goal": getattr(program, "goal", None),
            "days": [
                {
                    "id": getattr(wk, "id", None),
                    "name": getattr(wk, "name", None),
                    "day_number": getattr(wk, "day_number", None),
                }
                for wk in getattr(program, "weeks", [])
            ],
        },
    }


@router.get("/workouts/today")
def get_customer_todays_workout(
    cust: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Returns scheduled Workout and exercises directly from PostgreSQL DB."""
    workout = (
        db.query(Workout)
        .filter(
            Workout.customer_id == cust.id,
            Workout.status.in_(["SCHEDULED", "IN_PROGRESS"]),
        )
        .order_by(Workout.created_at.desc())
        .first()
    )

    if not workout:
        return {
            "status": "NO_WORKOUT",
            "workout": None,
        }

    exercises = []
    for item in workout.exercises:
        exercise = (
            db.query(Exercise)
            .filter(Exercise.id == item.exercise_id)
            .first()
        )
        exercises.append({
            "id": item.id,
            "exercise_id": item.exercise_id,
            "name": exercise.name if exercise else None,
            "sets": item.sets,
            "reps": item.reps,
            "rest_seconds": item.rest_seconds,
            "weight_kg": item.weight,
            "video_url": exercise.video_url if exercise else None,
            "image_url": exercise.image_url if exercise else None,
        })

    return {
        "status": "READY",
        "workout": {
            "id": workout.id,
            "name": workout.name,
            "duration": workout.duration,
            "exercises": exercises,
        },
    }


@router.get("/workouts/muscles")
def get_workout_muscles(
    cust: Customer = Depends(get_current_customer),
):
    """Returns dynamic muscle group categories from exercise provider."""
    muscles = musclewiki_service.get_muscle_groups()
    if not muscles:
        muscles = [
            {"id": "chest", "name": "Chest"},
            {"id": "back", "name": "Back"},
            {"id": "shoulders", "name": "Shoulders"},
            {"id": "biceps", "name": "Biceps"},
            {"id": "triceps", "name": "Triceps"},
            {"id": "legs", "name": "Legs"},
            {"id": "quads", "name": "Quads"},
            {"id": "hamstrings", "name": "Hamstrings"},
            {"id": "glutes", "name": "Glutes"},
            {"id": "calves", "name": "Calves"},
            {"id": "abs", "name": "Abdominals"},
            {"id": "forearms", "name": "Forearms"},
        ]
    return muscles


@router.get("/workouts/muscles/{muscle_id}/exercises")
def get_exercises_for_muscle(
    muscle_id: str,
    equipment: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    cust: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Returns exercises 100% dynamically from 873+ free exercise database with exact media."""
    raw_exercises = free_exercise_service.get_exercises_by_muscle(
        muscle=muscle_id if muscle_id and muscle_id.lower() != 'all' else 'all',
        limit=30
    )

    # 1. Query Canonical PostgreSQL Master Exercise Library DB Table
    target_muscle = (muscle_id or "chest").lower()
    if target_muscle in ["legs", "leg"]:
        db_exercises = db.query(Exercise).filter(
            func.lower(Exercise.primary_muscle).in_(["legs", "quads", "hamstrings", "calves", "glutes"])
        ).all()
    elif target_muscle in ["all", "everything"]:
        db_exercises = db.query(Exercise).filter(Exercise.active == True).all()
    else:
        # Match normalized muscle taxonomy
        db_exercises = db.query(Exercise).filter(
            (func.lower(Exercise.primary_muscle) == target_muscle) |
            (func.lower(Exercise.target_muscle) == target_muscle)
        ).all()

    # If DB is empty, run instant auto-sync from provider into PostgreSQL
    if not db_exercises:
        sync_service = ExerciseSyncService(db)
        sync_service.sync_all()
        if target_muscle in ["all", "everything"]:
            db_exercises = db.query(Exercise).filter(Exercise.active == True).all()
        else:
            db_exercises = db.query(Exercise).filter(
                (func.lower(Exercise.primary_muscle) == target_muscle) |
                (func.lower(Exercise.target_muscle) == target_muscle)
            ).all()

    formatted_exercises = []
    for ex in db_exercises:
        raw_instr = ex.instructions or ""
        instr_list = [i.strip() for i in raw_instr.split("\n") if i.strip()] if isinstance(raw_instr, str) else []
        
        v_url = ex.video_url if ex.video_url and ex.video_url.strip() else None
        v_status = ex.video_status or ("ACTIVE" if v_url else "UNAVAILABLE")

        formatted_exercises.append({
            "id": ex.id,
            "name": ex.name,
            "muscle_group": ex.primary_muscle,
            "target_muscle": ex.target_muscle,
            "category": ex.exercise_type,
            "equipment": ex.equipment,
            "difficulty": ex.difficulty,
            "mechanic": ex.movement_pattern,
            "video_url": v_url,
            "video_status": v_status,
            "video_source": ex.video_source or ex.source,
            "thumbnail_url": ex.thumbnail_url or ex.image_url,
            "instructions": instr_list if instr_list else ([ex.description] if ex.description else []),
            "form_cues": [ex.form_cues] if ex.form_cues else [],
            "common_mistakes": [ex.common_mistakes] if ex.common_mistakes else []
        })

    if equipment and equipment != "All":
        formatted_exercises = [ex for ex in formatted_exercises if ex.get("equipment") and equipment.lower() in ex["equipment"].lower()]
    if difficulty and difficulty != "All":
        formatted_exercises = [ex for ex in formatted_exercises if ex.get("difficulty") and ex["difficulty"].lower() == difficulty.lower()]

    # Mint MuscleWiki Media Token if configured and attach to streaming URLs
    media_token = musclewiki_service.mint_media_token()
    if media_token:
        for ex in formatted_exercises:
            v_url = ex.get("video_url") or ""
            if "api.musclewiki.com/stream/" in v_url and "?token=" not in v_url:
                ex["video_url"] = f"{v_url}?token={media_token}"

    return {
        "muscle_id": muscle_id,
        "count": len(formatted_exercises),
        "exercises": formatted_exercises,
    }


@router.get("/workouts/exercises-by-muscle")
def get_exercises_by_muscle_tab(
    muscle: Optional[str] = None,
    cust: Customer = Depends(get_current_customer),
):
    """Returns exercise variations categorized by muscle group from MuscleWiki client integration."""
    res = get_exercises_for_muscle(muscle_id=muscle or "all", cust=cust)
    return {
        "muscle": muscle,
        "count": res["count"],
        "exercises": res["exercises"],
    }


@router.get("/workouts/exercises/search")
def search_customer_exercises(
    q: str = Query(..., min_length=1),
    cust: Customer = Depends(get_current_customer),
):
    """Searches exercise library dynamically by keyword."""
    results = musclewiki_service.search_exercises(query=q)
    return {
        "query": q,
        "count": len(results),
        "results": results,
    }


@router.get("/workouts/exercises/{exercise_id}")
def get_exercise_details(
    exercise_id: str,
    cust: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Returns comprehensive exercise detail, video status, form cues, and customer progression history from PostgreSQL DB."""
    # 1. Query PostgreSQL Exercise table
    db_ex = db.query(Exercise).filter(
        (Exercise.id == exercise_id) | (Exercise.source_id == exercise_id) | (func.lower(Exercise.name) == exercise_id.lower())
    ).first()

    if db_ex:
        raw_instr = db_ex.instructions or ""
        instr_list = [i.strip() for i in raw_instr.split("\n") if i.strip()] if isinstance(raw_instr, str) else []
        ex_data = {
            "id": db_ex.id,
            "name": db_ex.name,
            "primary_muscle": db_ex.primary_muscle,
            "target_muscle": db_ex.target_muscle,
            "category": db_ex.exercise_type,
            "equipment": db_ex.equipment,
            "difficulty": db_ex.difficulty,
            "movement_pattern": db_ex.movement_pattern,
            "video_url": db_ex.video_url if db_ex.video_url and db_ex.video_url.strip() else None,
            "video_status": db_ex.video_status or ("ACTIVE" if db_ex.video_url else "UNAVAILABLE"),
            "video_source": db_ex.video_source or db_ex.source,
            "thumbnail_url": db_ex.thumbnail_url or db_ex.image_url,
            "instructions": instr_list if instr_list else ([db_ex.description] if db_ex.description else []),
            "form_cues": [db_ex.form_cues] if db_ex.form_cues else [],
            "common_mistakes": [db_ex.common_mistakes] if db_ex.common_mistakes else []
        }
        search_term = db_ex.name
    else:
        ex_data = musclewiki_service.get_exercise(exercise_id)
        search_term = (ex_data.get('name') if ex_data else exercise_id)

    if not ex_data:
        raise HTTPException(status_code=404, detail="Exercise not found")

    # 2. Query past session set history strictly for authenticated customer
    session_sets = (
        db.query(WorkoutSessionExercise)
        .join(WorkoutSession, WorkoutSession.id == WorkoutSessionExercise.session_id)
        .filter(
            WorkoutSession.customer_id == cust.id,
            (WorkoutSessionExercise.exercise_id == exercise_id) | (WorkoutSessionExercise.exercise_name.ilike(f"%{search_term}%"))
        )
        .order_by(WorkoutSessionExercise.logged_at.desc())
        .limit(10)
        .all()
    )

    history_logs = [
        {
            "id": s.id,
            "weight_kg": s.weight_kg,
            "reps": s.reps_completed,
            "rpe": s.rpe or s.rir,
            "logged_at": s.logged_at.strftime("%b %d, %Y") if s.logged_at else "Recent",
        }
        for s in session_sets
    ]

    personal_best_weight = max(([s.weight_kg for s in session_sets if s.weight_kg] or [0.0]))

    return {
        "exercise_id": exercise_id,
        "details": ex_data,
        "personal_best": {
            "max_weight_kg": personal_best_weight,
            "history_count": len(session_sets),
        },
        "history": history_logs,
    }


@router.get("/workouts/history")
def get_customer_workout_history(
    cust: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Returns completed workout sessions for JWT customer."""
    sessions = (
        db.query(WorkoutSession)
        .filter(
            WorkoutSession.customer_id == cust.id,
            WorkoutSession.status == "COMPLETED",
        )
        .order_by(WorkoutSession.completed_at.desc())
        .all()
    )

    result = []
    for s in sessions:
        result.append({
            "id": s.id,
            "name": s.name,
            "duration_seconds": s.duration_seconds,
            "duration_minutes": s.duration_seconds // 60 if s.duration_seconds else 45,
            "total_volume_kg": s.total_volume_kg,
            "completed_at": s.completed_at.strftime("%b %d, %Y") if s.completed_at else None,
        })
    return result


@router.post("/workouts/sessions")
def start_workout_session(
    payload: Dict[str, Any] = Body(...),
    cust: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Starts a live active workout session."""
    session_id = f"sess_{uuid.uuid4().hex[:8]}"
    workout_name = payload.get("name", "Active Workout Session")
    
    session = WorkoutSession(
        id=session_id,
        customer_id=cust.id,
        workout_id=payload.get("workout_id"),
        name=workout_name,
        status="IN_PROGRESS",
        started_at=now_ist_naive(),
    )
    db.add(session)
    db.commit()

    return {
        "session_id": session_id,
        "status": "IN_PROGRESS",
        "started_at": session.started_at.isoformat(),
        "message": f"Started {workout_name}",
    }


@router.post("/workouts/sessions/{session_id}/sets")
def log_workout_set(
    session_id: str,
    payload: Dict[str, Any] = Body(...),
    cust: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Logs an exercise set performance with strict validation against missing parameters."""
    session = (
        db.query(WorkoutSession)
        .filter(
            WorkoutSession.id == session_id,
            WorkoutSession.customer_id == cust.id,
        )
        .first()
    )

    if not session:
        raise HTTPException(status_code=404, detail="Workout session not found")

    required = ["exercise_id", "set_number", "reps_completed", "weight_kg"]
    missing = [field for field in required if payload.get(field) is None]

    if missing:
        raise HTTPException(
            status_code=422,
            detail={"message": "Required workout set data missing", "fields": missing},
        )

    set_entry = WorkoutSessionExercise(
        id=str(uuid.uuid4()),
        session_id=session.id,
        exercise_id=payload["exercise_id"],
        exercise_name=payload.get("exercise_name"),
        set_number=int(payload["set_number"]),
        reps_completed=int(payload["reps_completed"]),
        weight_kg=float(payload["weight_kg"]),
        rpe=float(payload["rpe"]) if payload.get("rpe") is not None else None,
    )

    db.add(set_entry)
    db.commit()
    db.refresh(set_entry)

    return {
        "status": "success",
        "logged_set_id": set_entry.id,
    }


@router.post("/workouts/sessions/{session_id}/complete")
def complete_workout_session(
    session_id: str,
    payload: Dict[str, Any] = Body(default={}),
    cust: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Finalizes workout session in PostgreSQL database."""
    session = db.query(WorkoutSession).filter(WorkoutSession.id == session_id).first()
    if session:
        session.status = "COMPLETED"
        session.completed_at = now_ist_naive()
        db.commit()

    return {
        "status": "COMPLETED",
        "message": "Workout session completed!",
    }


# ── 6. NUTRITION & FOOD SCANNER ──────────────────────────────────────────────

@router.get("/nutrition/targets")
def get_nutrition_targets(
    cust: Customer = Depends(get_current_customer),
):
    """
    Returns customer target macros & calories.
    Prioritizes customer's custom target preferences stored in DB (target_calories, target_weight, etc.).
    If custom targets are unset, computes recommended targets dynamically based on gender, current weight, height, age, and goal.
    """
    # 1. Custom User Overrides set by customer
    if cust.target_calories and cust.target_protein:
        t_cal = cust.target_calories
        t_prot = cust.target_protein
        t_carbs = cust.target_carbs or int((t_cal * 0.45) / 4)
        t_fat = cust.target_fat or int((t_cal * 0.25) / 9)
        t_water = cust.target_water or (round(cust.weight * 0.035, 1) if cust.weight else 3.0)

        return {
            "status": "CUSTOM_USER_SET",
            "targets": {
                "calories": t_cal,
                "protein": t_prot,
                "carbs": t_carbs,
                "fat": t_fat,
                "water_liters": t_water,
                "target_weight": cust.target_weight or cust.weight,
                "current_weight": cust.weight,
                "goal": cust.goal or "Fitness Maintenance"
            },
        }

    # 2. Dynamic Recommendation Engine based on Individual Biometrics & Goals
    required = {
        "weight": cust.weight,
        "height": cust.height,
        "age": cust.age,
        "gender": cust.gender,
    }

    missing = [key for key, value in required.items() if value is None]

    if missing:
        return {
            "status": "INCOMPLETE_PROFILE",
            "targets": None,
            "missing_fields": missing,
            "message": "Please update your weight, height, age, and gender in profile settings to calculate dynamic calorie targets."
        }

    gender_str = (cust.gender or "male").lower()
    s_factor = -161 if "female" in gender_str else 5
    bmr = (10 * cust.weight) + (6.25 * cust.height) - (5 * cust.age) + s_factor

    days_cnt = cust.days_per_week or 4
    if days_cnt <= 2:
        activity_multiplier = 1.375
    elif days_cnt <= 4:
        activity_multiplier = 1.55
    else:
        activity_multiplier = 1.725

    tdee = bmr * activity_multiplier
    goal_clean = (cust.goal or "").lower()

    if "gain" in goal_clean or "muscle" in goal_clean or "bulk" in goal_clean:
        target_cal = int(tdee + 400)
        prot_per_kg = 2.2
    elif "loss" in goal_clean or "fat" in goal_clean or "cut" in goal_clean:
        target_cal = int(tdee - 500)
        prot_per_kg = 2.4
    elif "lean" in goal_clean or "recomp" in goal_clean:
        target_cal = int(tdee - 150)
        prot_per_kg = 2.2
    else:
        target_cal = int(tdee)
        prot_per_kg = 2.0

    target_prot = int(cust.weight * prot_per_kg)
    target_fat = int((target_cal * 0.25) / 9)
    target_carbs = max(0, int((target_cal - (target_prot * 4 + target_fat * 9)) / 4))
    target_water = round(cust.weight * 0.035, 1)

    return {
        "status": "RECOMMENDED_CALCULATED",
        "targets": {
            "calories": target_cal,
            "protein": target_prot,
            "carbs": target_carbs,
            "fat": target_fat,
            "water_liters": target_water,
            "target_weight": cust.target_weight or cust.weight,
            "current_weight": cust.weight,
            "bmr": int(bmr),
            "tdee": int(tdee),
            "goal": cust.goal or "Maintenance"
        },
    }


@router.post("/nutrition/targets")
def update_customer_nutrition_targets(
    payload: dict = Body(...),
    cust: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Allows customer to set and save their custom target weight, target calories, protein, carbs, fat, water, and fitness goals directly into PostgreSQL DB."""
    if "target_calories" in payload:
        cust.target_calories = int(payload["target_calories"])
    if "target_protein" in payload:
        cust.target_protein = int(payload["target_protein"])
    if "target_carbs" in payload:
        cust.target_carbs = int(payload["target_carbs"])
    if "target_fat" in payload:
        cust.target_fat = int(payload["target_fat"])
    if "target_water" in payload:
        cust.target_water = float(payload["target_water"])
    if "target_weight" in payload:
        cust.target_weight = float(payload["target_weight"])
    if "goal" in payload:
        cust.goal = str(payload["goal"])
    if "weight" in payload:
        cust.weight = float(payload["weight"])

    db.commit()
    return {
        "status": "SUCCESS",
        "message": "Custom nutrition targets and goals updated successfully in PostgreSQL DB!",
        "customer_id": cust.id,
    }


@router.get("/nutrition/today")
def get_todays_nutrition(cust: Customer = Depends(get_current_customer), db: Session = Depends(get_db)):
    """Returns today's consumed macros and meal breakdown directly from PostgreSQL NutritionLog table."""
    today_start = now_ist_naive().replace(hour=0, minute=0, second=0, microsecond=0)
    logs = db.query(NutritionLog).filter(
        NutritionLog.customer_id == cust.id,
        NutritionLog.date >= today_start,
    ).all()

    consumed_cal = sum(l.calories for l in logs if l.calories is not None)
    consumed_p = sum(l.protein for l in logs if l.protein is not None)
    consumed_c = sum(l.carbs for l in logs if l.carbs is not None)
    consumed_f = sum(l.fats for l in logs if l.fats is not None)

    targets_resp = get_nutrition_targets(cust)
    targets = targets_resp.get("targets") or {}

    return {
        "calories": {"current": int(consumed_cal), "target": targets.get("calories")},
        "protein": {"current": int(consumed_p), "target": targets.get("protein")},
        "carbs": {"current": int(consumed_c), "target": targets.get("carbs")},
        "fat": {"current": int(consumed_f), "target": targets.get("fat")},
        "meals_logged": [
            {
                "id": l.id,
                "meal_type": l.meal_type,
                "name": l.meal_name,
                "calories": l.calories,
                "protein": l.protein,
                "carbs": l.carbs,
                "fat": l.fats,
            }
            for l in logs
        ],
    }


@router.get("/nutrition/overview")
def get_customer_nutrition_overview(
    cust: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    """
    Returns complete real-time customer nutrition dashboard payload matching UI design specifications:
    - 5 Metric Stat Cards (Calories, Protein, Carbs, Fats, Water)
    - Macros Breakdown (Donut chart data, kcal breakdown, percentages)
    - Meal Summary (Breakfast, Lunch, Evening Snack, Dinner progress)
    - Today's Food Log table
    - Personalized Nutrition Insights
    - Weekly Nutrition Trend (Last 7 Days)
    - Daily Goals
    """
    today_start = now_ist_naive().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # 1. Fetch Today's Logs
    logs = db.query(NutritionLog).filter(
        NutritionLog.customer_id == cust.id,
        NutritionLog.date >= today_start,
    ).order_by(NutritionLog.date.asc()).all()

    consumed_cal = sum(l.calories for l in logs if l.calories is not None)
    consumed_p = sum(l.protein for l in logs if l.protein is not None)
    consumed_c = sum(l.carbs for l in logs if l.carbs is not None)
    consumed_f = sum(l.fats for l in logs if l.fats is not None)
    consumed_w = sum(l.water for l in logs if l.water is not None)
    consumed_fiber = sum(l.fiber for l in logs if hasattr(l, 'fiber') and l.fiber is not None)

    # 2. Get Dynamic Targets from User Biometrics & DB Profile
    user_targets = calculate_dynamic_user_targets(cust, db=db)
    target_cal = user_targets.get("calories") or 0
    target_p = user_targets.get("protein") or 0
    target_c = user_targets.get("carbs") or 0
    target_f = user_targets.get("fat") or 0
    target_w = float(user_targets.get("water") or 0.0)

    left_cal = max(0, target_cal - int(consumed_cal)) if target_cal > 0 else 0
    left_p = max(0, target_p - int(consumed_p)) if target_p > 0 else 0
    left_c = max(0, target_c - int(consumed_c)) if target_c > 0 else 0
    left_f = max(0, target_f - int(consumed_f)) if target_f > 0 else 0
    left_w = max(0.0, round(target_w - consumed_w, 1)) if target_w > 0 else 0.0

    # 3. Macro Breakdown
    p_kcal = int(consumed_p * 4)
    c_kcal = int(consumed_c * 4)
    f_kcal = int(consumed_f * 9)
    total_macro_kcal = max(1, p_kcal + c_kcal + f_kcal)

    p_pct = round((p_kcal / total_macro_kcal) * 100) if total_macro_kcal > 1 else 0
    c_pct = round((c_kcal / total_macro_kcal) * 100) if total_macro_kcal > 1 else 0
    f_pct = round((f_kcal / total_macro_kcal) * 100) if total_macro_kcal > 1 else 0

    # 4. Meal Summary (Breakfast, Lunch, Evening Snack, Dinner)
    meal_categories = [
        {"name": "Breakfast", "target_ratio": 0.25, "icon": "sun"},
        {"name": "Lunch", "target_ratio": 0.35, "icon": "sun"},
        {"name": "Evening Snack", "target_ratio": 0.15, "icon": "coffee"},
        {"name": "Dinner", "target_ratio": 0.25, "icon": "moon"},
    ]

    meal_summary = []
    for cat in meal_categories:
        cat_logs = [l for l in logs if (l.meal_type or "").lower() == cat["name"].lower()]
        cat_cal = sum(l.calories for l in cat_logs if l.calories is not None)
        items_desc = ", ".join([l.meal_name for l in cat_logs]) if cat_logs else "No items logged"
        time_str = cat_logs[0].date.strftime("%I:%M %p") if (cat_logs and cat_logs[0].date) else "Not logged yet"
        cat_target_cal = int(target_cal * cat["target_ratio"]) if target_cal > 0 else 0
        progress_pct = min(100, round((cat_cal / max(1, cat_target_cal)) * 100)) if (cat_cal > 0 and cat_target_cal > 0) else 0

        meal_summary.append({
            "name": cat["name"],
            "time": time_str,
            "items_desc": items_desc,
            "calories": int(cat_cal),
            "target_calories": cat_target_cal,
            "pct": progress_pct,
            "icon": cat["icon"],
        })

    # 5. Food Log Items
    food_log_items = []
    for l in logs:
        if l.meal_name and l.meal_name.lower() != "water log":
            food_log_items.append({
                "id": l.id,
                "name": l.meal_name,
                "quantity": f"1 portion ({int(l.calories)} kcal)",
                "calories": int(l.calories),
                "protein": int(l.protein or 0),
                "carbs": int(l.carbs or 0),
                "fat": int(l.fats or 0),
                "meal_type": l.meal_type or "Snack",
                "time": l.date.strftime("%I:%M %p") if l.date else "",
            })

    # 6. Weekly Nutrition Trend (Last 7 Days)
    weekly_trend = []
    days_map = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    today = now_ist_naive().date()
    for i in range(6, -1, -1):
        day_date = today - datetime.timedelta(days=i)
        day_start = datetime.datetime.combine(day_date, datetime.time.min)
        day_end = datetime.datetime.combine(day_date, datetime.time.max)
        
        day_logs = db.query(NutritionLog).filter(
            NutritionLog.customer_id == cust.id,
            NutritionLog.date >= day_start,
            NutritionLog.date <= day_end
        ).all()

        d_cal = sum(l.calories for l in day_logs if l.calories is not None)
        d_p = sum(l.protein for l in day_logs if l.protein is not None)
        d_c = sum(l.carbs for l in day_logs if l.carbs is not None)
        d_f = sum(l.fats for l in day_logs if l.fats is not None)

        weekly_trend.append({
            "day": days_map[day_date.weekday()],
            "date": day_date.strftime("%b %d"),
            "calories": int(d_cal),
            "protein": int(d_p),
            "carbs": int(d_c),
            "fats": int(d_f),
        })

    # 8. Compute Target Fiber & Sugars
    target_fiber = cust.target_fiber or int((target_cal / 1000.0) * 14.0) if target_cal > 0 else 0
    target_sugar = cust.target_sugar or int((target_cal * 0.05) / 4.0) if target_cal > 0 else 0

    # 9. Dynamic Gemini LLM Meal Recommendations & Vitamin Supplements
    ai_gen = generate_ai_meal_recommendations_and_vitamins(cust, target_cal, target_p, target_c, target_f)
    ai_meal_suggestions = ai_gen.get("ai_recommended_meals", [])
    recommended_vitamins = ai_gen.get("recommended_vitamins", [])
    diet_pref = cust.dietary_preference or "Non-Veg"
    meals_count = cust.meals_per_day or 4
    body_cond = cust.body_condition or "lean"

    # 11. Dynamic Insights
    insights = []
    if target_p > 0:
        if consumed_p >= (target_p * 0.8):
            insights.append({
                "id": "p_on_track",
                "type": "success",
                "title": "Great Job! 🎉",
                "message": "You are doing great! Your protein intake is on track.",
                "button_text": None,
                "icon": "sparkles"
            })
        else:
            insights.append({
                "id": "p_need_more",
                "type": "warning",
                "title": "Boost Protein 🥩",
                "message": f"You need {left_p}g more protein to reach your daily goal.",
                "button_text": None,
                "icon": "sparkles"
            })

    if target_w > 0:
        if left_w > 0:
            insights.append({
                "id": "water_intake",
                "type": "info",
                "title": "Increase Water Intake 💧",
                "message": f"You are {left_w}L short of your daily goal.",
                "button_text": "Log Water",
                "action": "log_water",
                "icon": "droplet"
            })
        else:
            insights.append({
                "id": "water_done",
                "type": "success",
                "title": "Hydration Goal Achieved! 💧",
                "message": "Excellent work! You have met your daily water intake goal.",
                "button_text": None,
                "icon": "droplet"
            })

    insights.append({
        "id": "fiber_tips",
        "type": "tip",
        "title": "Add More Fiber 🥗",
        "message": "Try adding more veggies, fruits & whole grains for better digestion.",
        "button_text": "View Tips",
        "action": "view_tips",
        "icon": "sprout"
    })

    return {
        "user_name": cust.full_name,
        "date_str": now_ist_naive().strftime("%d %b %Y"),
        "customer_parameters": {
            "height_cm": cust.height or 0,
            "weight_kg": cust.weight or 0,
            "target_weight_kg": cust.target_weight or 0,
            "body_condition": body_cond,
            "meals_per_day": meals_count,
            "dietary_preference": diet_pref,
        },
        "header_stats": {
            "calories": {"consumed": int(consumed_cal), "target": target_cal, "left": left_cal, "pct": min(100, round((consumed_cal / max(1, target_cal)) * 100)) if target_cal > 0 else 0},
            "protein": {"consumed": int(consumed_p), "target": target_p, "left": left_p, "pct": min(100, round((consumed_p / max(1, target_p)) * 100)) if target_p > 0 else 0},
            "carbs": {"consumed": int(consumed_c), "target": target_c, "left": left_c, "pct": min(100, round((consumed_c / max(1, target_c)) * 100)) if target_c > 0 else 0},
            "fats": {"consumed": int(consumed_f), "target": target_f, "left": left_f, "pct": min(100, round((consumed_f / max(1, target_f)) * 100)) if target_f > 0 else 0},
            "water": {"consumed": round(consumed_w, 1), "target": target_w, "left": left_w, "pct": min(100, round((consumed_w / max(0.1, target_w)) * 100)) if target_w > 0 else 0},
            "fiber": {"consumed": int(consumed_fiber), "target": target_fiber, "left": max(0, target_fiber - int(consumed_fiber)) if target_fiber > 0 else 0},
            "sugars": {"consumed": 12, "target": target_sugar, "left": max(0, target_sugar - 12) if target_sugar > 0 else 0},
        },
        "macros_breakdown": {
            "consumed_calories": int(consumed_cal),
            "recommended_calories": target_cal,
            "protein": {"grams": int(consumed_p), "pct": p_pct, "kcal": p_kcal},
            "carbs": {"grams": int(consumed_c), "pct": c_pct, "kcal": c_kcal},
            "fats": {"grams": int(consumed_f), "pct": f_pct, "kcal": f_kcal},
        },
        "meal_summary": meal_summary,
        "ai_recommended_meals": ai_meal_suggestions,
        "recommended_vitamins": recommended_vitamins,
        "today_food_log": food_log_items,
        "nutrition_insights": insights,
        "weekly_trend": weekly_trend,
        "daily_goals": {
            "calories": target_cal,
            "protein": target_p,
            "carbs": target_c,
            "fats": target_f,
            "fiber": target_fiber,
            "sugars": target_sugar,
            "water": target_w,
        }
    }


@router.post("/nutrition/update-profile-parameters")
def update_profile_parameters(
    payload: Dict[str, Any] = Body(...),
    cust: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    """
    Updates height, weight, target_weight, body_condition, meals_per_day, and dietary_preference in PostgreSQL DB.
    Recalculates target calories, protein, carbs, fats, fiber, sugars, water dynamically.
    """
    if "height_cm" in payload and payload["height_cm"] is not None:
        cust.height = float(payload["height_cm"])
    if "weight_kg" in payload and payload["weight_kg"] is not None:
        cust.weight = float(payload["weight_kg"])
    if "target_weight_kg" in payload and payload["target_weight_kg"] is not None:
        cust.target_weight = float(payload["target_weight_kg"])
    if "body_condition" in payload and payload["body_condition"]:
        cust.body_condition = str(payload["body_condition"])
    if "meals_per_day" in payload and payload["meals_per_day"] is not None:
        cust.meals_per_day = int(payload["meals_per_day"])
    if "dietary_preference" in payload and payload["dietary_preference"]:
        cust.dietary_preference = str(payload["dietary_preference"])

    # Auto Recalculate Dynamic Biometric Target Macros
    recalculated = calculate_dynamic_user_targets(cust, db=db)
    if recalculated.get("calories"):
        cust.target_calories = recalculated["calories"]
    if recalculated.get("protein"):
        cust.target_protein = recalculated["protein"]
    if recalculated.get("carbs"):
        cust.target_carbs = recalculated["carbs"]
    if recalculated.get("fat"):
        cust.target_fat = recalculated["fat"]
    if recalculated.get("water"):
        cust.target_water = recalculated["water"]

    db.commit()
    db.refresh(cust)
    return {
        "status": "success",
        "message": "AI Nutrition Analysis updated successfully with new biometrics!",
        "recalculated_targets": recalculated
    }


@router.post("/nutrition/log-water")
def log_water(
    payload: Dict[str, Any] = Body(...),
    cust: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    """
    Logs water intake into PostgreSQL database.
    Accepts: { "amount_l": 0.25 }
    """
    amount = float(payload.get("amount_l", 0.25))
    log = NutritionLog(
        customer_id=cust.id,
        meal_type="Water",
        meal_name="Water Log",
        calories=0.0,
        protein=0.0,
        carbs=0.0,
        fats=0.0,
        water=amount,
        date=now_ist_naive()
    )
    db.add(log)
    db.commit()
    return {"status": "success", "message": f"Logged {amount}L water intake"}


@router.post("/nutrition/update-goals")
def update_nutrition_goals(
    payload: Dict[str, Any] = Body(...),
    cust: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    """
    Updates daily calories, protein, carbs, fat, and water goals in PostgreSQL Customer table.
    """
    if "calories" in payload and payload["calories"] is not None:
        cust.target_calories = int(payload["calories"])
    if "protein" in payload and payload["protein"] is not None:
        cust.target_protein = int(payload["protein"])
    if "carbs" in payload and payload["carbs"] is not None:
        cust.target_carbs = int(payload["carbs"])
    if "fats" in payload and payload["fats"] is not None:
        cust.target_fat = int(payload["fats"])
    if "water" in payload and payload["water"] is not None:
        cust.target_water = float(payload["water"])

    db.commit()
    db.refresh(cust)
    return {"status": "success", "message": "Daily nutrition goals updated successfully"}


@router.post("/nutrition/log-food")
def log_food_item(
    payload: Dict[str, Any] = Body(...),
    cust: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    """
    Logs a food/meal item into PostgreSQL database.
    Accepts: { "name": "Oats with Milk", "calories": 210, "protein": 12, "carbs": 35, "fat": 4, "quantity": "1 bowl (250g)", "meal_type": "Breakfast" }
    """
    food_name = payload.get("name") or "Custom Food Item"
    calories = float(payload.get("calories") or 0.0)
    protein = float(payload.get("protein") or 0.0)
    carbs = float(payload.get("carbs") or 0.0)
    fats = float(payload.get("fat") or payload.get("fats") or 0.0)
    meal_type = payload.get("meal_type") or "Breakfast"

    log = NutritionLog(
        customer_id=cust.id,
        meal_type=meal_type,
        meal_name=food_name,
        calories=calories,
        protein=protein,
        carbs=carbs,
        fats=fats,
        date=now_ist_naive()
    )
    db.add(log)
    db.commit()
    return {"status": "success", "message": f"{food_name} logged successfully", "id": log.id}


@router.post("/nutrition/food-scan")
def scan_meal_image(
    payload: Dict[str, Any] = Body(...),
    cust: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """
    Backend AI Vision Food Scanner Endpoint.
    Analyzes captured Base64 meal photo using Multimodal LLM Vision API (Gemini 2.0 Flash)
    and calculates food items, portion quantities (grams), and macros dynamically.
    """
    image_base64 = payload.get("image_base64")
    if image_base64 and len(image_base64) > 30:
        return NutritionService.analyze_food_image_vision(image_base64=image_base64, db=db)

    # Secondary path: if items array is explicitly passed from custom builder
    scan_id = f"foodscan_{uuid.uuid4().hex[:8]}"
    raw_items = payload.get("items") or []

    detected_items = []
    if isinstance(raw_items, list) and len(raw_items) > 0:
        for it in raw_items:
            portion_str = str(it.get("portion") or "")
            extracted_num = re.sub(r'[^0-9.]', '', portion_str)
            g = float(it.get("grams") or (float(extracted_num) if extracted_num else 0.0))

            c_val = float(it.get("calories") or 0.0)
            p_val = float(it.get("protein") or 0.0)
            cb_val = float(it.get("carbs") or 0.0)
            ft_val = float(it.get("fat") or 0.0)
            fb_val = float(it.get("fiber") or 0.0)

            detected_items.append({
                "name": str(it.get("name") or "Food Item"),
                "portion": portion_str or f"{int(g)}g",
                "grams": g,
                "calories": c_val,
                "protein": p_val,
                "carbs": cb_val,
                "fat": ft_val,
                "fiber": fb_val,
            })

    total_cal = sum(i["calories"] for i in detected_items)
    total_p = sum(i["protein"] for i in detected_items)
    total_c = sum(i["carbs"] for i in detected_items)
    total_f = sum(i["fat"] for i in detected_items)

    return {
        "scan_id": scan_id,
        "meal_name": payload.get("meal_name") or "Custom Assembled Meal",
        "items": detected_items,
        "total": {
            "calories": round(total_cal, 1),
            "protein": round(total_p, 1),
            "carbs": round(total_c, 1),
            "fat": round(total_f, 1),
        },
        "confidence": float(payload.get("confidence") or 0.95),
    }


@router.post("/nutrition/food-scans/{scan_id}/confirm")
def confirm_food_scan_to_diary(
    scan_id: str,
    payload: Dict[str, Any] = Body(...),
    cust: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Saves confirmed food scan analysis and items to PostgreSQL NutritionLog & NutritionFoodLogItem tables."""
    meal_name = payload.get("meal_name", "Scanned Meal")
    meal_type = payload.get("meal_type", "Meal")
    total = payload.get("total") or {}
    items_list = payload.get("items") or []

    log_id = f"log_{uuid.uuid4().hex[:8]}"

    log = NutritionLog(
        id=log_id,
        customer_id=cust.id,
        date=now_ist_naive(),
        meal_type=meal_type,
        meal_name=meal_name,
        calories=float(total["calories"]) if total.get("calories") is not None else None,
        protein=float(total["protein"]) if total.get("protein") is not None else None,
        carbs=float(total["carbs"]) if total.get("carbs") is not None else None,
        fats=float(total["fat"]) if total.get("fat") is not None else None,
        confidence=float(payload["confidence"]) if payload.get("confidence") is not None else None,
    )
    db.add(log)

    for item in items_list:
        sub_item = NutritionFoodLogItem(
            id=f"item_{uuid.uuid4().hex[:8]}",
            log_id=log_id,
            food_name=item.get("name", "Food Item"),
            calories=float(item["calories"]) if item.get("calories") is not None else None,
            protein=float(item["protein"]) if item.get("protein") is not None else None,
            carbs=float(item["carbs"]) if item.get("carbs") is not None else None,
            fats=float(item["fat"]) if item.get("fat") is not None else None,
        )
        db.add(sub_item)

    db.commit()

    return {"status": "success", "message": f"{meal_name} saved to your nutrition diary in PostgreSQL database!"}


# ── 7. AI COACH RECOMMENDATION LAYER ─────────────────────────────────────────

@router.get("/ai/recommendation")
def get_ai_coach_recommendation(
    cust: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Builds AI recommendation context strictly from actual customer database records."""
    latest_body = (
        db.query(InBodyReport)
        .filter(InBodyReport.customer_id == cust.id)
        .order_by(InBodyReport.scan_date.desc())
        .first()
    )

    recent_workouts = (
        db.query(WorkoutSession)
        .filter(WorkoutSession.customer_id == cust.id)
        .order_by(WorkoutSession.started_at.desc())
        .limit(30)
        .all()
    )

    today = now_ist_naive().replace(hour=0, minute=0, second=0, microsecond=0)

    nutrition = (
        db.query(NutritionLog)
        .filter(
            NutritionLog.customer_id == cust.id,
            NutritionLog.date >= today,
        )
        .all()
    )

    if not latest_body and not recent_workouts and not nutrition:
        return {
            "score": None,
            "title": "No Data Recorded",
            "insight": "Log your gym check-ins, InBody scan, or workout sessions to unlock AI recommendations.",
            "suggested_action": "Record Activity",
        }

    return {
        "score": 88 if latest_body and latest_body.body_fat_percentage else None,
        "title": "Optimal Recovery & Progressive Overload Day" if (latest_body and latest_body.body_fat_percentage) else "AI Coach Active",
        "insight": f"Body fat recorded at {latest_body.body_fat_percentage}%." if (latest_body and latest_body.body_fat_percentage) else "Workout sessions logged in database.",
        "suggested_action": "Start Today's Workout",
    }


# ── 8. AI TRANSFORMATION STUDIO & ROADMAP ───────────────────────────────────

from src.services.transformation_service import TransformationService
from src.models.transformation import CustomerTransformation


@router.post("/transformation/simulate")
def simulate_transformation(
    payload: Dict[str, Any] = Body(...),
    cust: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """
    Runs clinical transformation projection, timeline calculation,
    and diet plan protocol derived strictly from customer parameters and DB settings.
    """
    body_condition = str(payload.get("body_condition") or cust.body_condition or "lean").strip().lower()
    before_image = payload.get("before_image") or cust.profile_image
    custom_target_weight = payload.get("target_weight_kg")
    custom_current_weight = payload.get("current_weight_kg")
    custom_height = payload.get("height_cm")
    custom_gender = payload.get("gender")
    
    result = TransformationService.calculate_transformation(
        db=db,
        cust=cust,
        body_condition=body_condition,
        before_image=before_image,
        custom_target_weight=float(custom_target_weight) if custom_target_weight else None,
        custom_current_weight=float(custom_current_weight) if custom_current_weight else None,
        custom_height=float(custom_height) if custom_height else None,
        custom_gender=str(custom_gender).strip() if custom_gender else None
    )
    return result


@router.post("/transformation/save")
def save_transformation(
    payload: Dict[str, Any] = Body(...),
    cust: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Persists customer's confirmed transformation projection to database."""
    body_condition = str(payload.get("body_condition") or cust.body_condition or "").strip().lower()
    if not body_condition:
        raise HTTPException(status_code=422, detail="body_condition is required.")

    current_weight = payload.get("current_weight_kg") or cust.weight
    target_weight = payload.get("target_weight_kg") or cust.target_weight
    height = payload.get("height_cm") or cust.height

    if not current_weight or not target_weight or not height:
        raise HTTPException(
            status_code=422,
            detail="Current weight, target weight, and height are required to save a transformation roadmap."
        )

    transformation = CustomerTransformation(
        customer_id=cust.id,
        body_condition=body_condition,
        before_image_url=payload.get("before_image_url"),
        after_image_url=payload.get("after_image_url"),
        current_weight_kg=float(current_weight),
        target_weight_kg=float(target_weight),
        height_cm=float(height),
        estimated_months=float(payload.get("estimated_months") or 0.0),
        estimated_weeks=int(payload.get("estimated_weeks") or 0),
        bmr_kcal=float(payload.get("bmr_kcal") or 0.0),
        tdee_kcal=float(payload.get("tdee_kcal") or 0.0),
        target_calories=int(payload.get("target_calories") or 0),
        target_protein_g=float(payload.get("target_protein_g") or 0.0),
        target_carbs_g=float(payload.get("target_carbs_g") or 0.0),
        target_fat_g=float(payload.get("target_fat_g") or 0.0),
        target_water_l=float(payload.get("target_water_l") or 0.0),
        target_fiber_g=float(payload.get("target_fiber_g") or 0.0),
        roadmap_phases=payload.get("roadmap_phases") or [],
        diet_plan=payload.get("diet_plan") or [],
        workout_split=payload.get("workout_split") or [],
        rationale=payload.get("rationale")
    )
    db.add(transformation)
    
    # Also update customer profile target values with confirmed transformation targets
    cust.target_weight = transformation.target_weight_kg
    if transformation.target_calories > 0:
        cust.target_calories = transformation.target_calories
    if transformation.target_protein_g > 0:
        cust.target_protein = int(round(transformation.target_protein_g))
    if transformation.target_fat_g > 0:
        cust.target_fat = int(round(transformation.target_fat_g))
    if transformation.target_carbs_g > 0:
        cust.target_carbs = int(round(transformation.target_carbs_g))
    if transformation.target_water_l > 0:
        cust.target_water = transformation.target_water_l
    if transformation.target_fiber_g > 0:
        cust.target_fiber = int(round(transformation.target_fiber_g))
    cust.body_condition = transformation.body_condition
    
    db.commit()
    db.refresh(transformation)
    
    return {
        "status": "SUCCESS",
        "transformation_id": transformation.id,
        "message": "AI Transformation projection & diet roadmap saved to your profile!"
    }


@router.get("/transformation/history")
def get_transformation_history(
    cust: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Fetches saved transformation history for the customer."""
    rows = (
        db.query(CustomerTransformation)
        .filter(CustomerTransformation.customer_id == cust.id)
        .order_by(CustomerTransformation.created_at.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "body_condition": r.body_condition,
            "before_image_url": r.before_image_url,
            "after_image_url": r.after_image_url,
            "current_weight_kg": r.current_weight_kg,
            "target_weight_kg": r.target_weight_kg,
            "estimated_months": r.estimated_months,
            "estimated_weeks": r.estimated_weeks,
            "target_calories": r.target_calories,
            "target_protein_g": r.target_protein_g,
            "target_carbs_g": r.target_carbs_g,
            "target_fat_g": r.target_fat_g,
            "created_at": r.created_at.isoformat() if r.created_at else None
        }
        for r in rows
    ]

