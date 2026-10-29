# HRMS Always-On GPS Tracking (Web + Mobile) & Facial-Recognition Check-In Plan

This document contains two tightly integrated implementation plans in execution order:
1. **PART A (Build First): Solid Always-On GPS Tracking on Login & Active Session (Web + Mobile PWA + Mobile App)** — captures employee/user GPS coordinates automatically whenever they log in, resume the app on mobile, or move during their session, **irrespective of the Geofence ("GPS Lock") setting or assigned punch method**.
2. **PART B (Build Second): HRMS Facial-Recognition Login & Check-In** — updated with all codebase & ML engine corrections (MediaPipe `FaceLandmarker` for 3D liveness + real metric face embeddings via `@vladmandic/face-api` 128-d or `onnxruntime-web` MobileFaceNet 512-d, reusing Part A's GPS engine).

---

# PART A: Solid GPS Tracking on Login & Session (Web + Mobile, Irrespective of GPS Lock)

## A.0 Why Web vs. Mobile Currently Diverges (Root-Cause Audit)

| Current Behavior in Codebase | Location | Why It Fails for "Always-On Login & Mobile GPS" |
|---|---|---|
| GPS is only requested inside `EmployeeSelfService.tsx` | `frontend/src/components/hrms/EmployeeSelfService.tsx:273-297, 389-408` | If a user logs in on mobile/web and stays on Dashboard, CRM, POS, or Sales without opening the ESS tab, **zero GPS coordinates are ever captured**. |
| `travelRoutesApi.ping` & `pingBatch` exist in API client & backend, but are **never called** | `frontend/src/lib/api-client.ts:6336-6340`, `backend/src/api/v1/hrms/travel_routes.py:108-229` | The backend table `EmployeeLocationTrail` (`hrms_employee_location_trails`) and Live Radar UI (`EmployeeRouteMapStudio.tsx`) are already built, but no frontend service sends real pings on login or session! |
| Geofence Lock (`enforce_geofence`) blocks & discards out-of-bounds coordinates | `backend/src/api/v1/hrms/attendance.py:1097-1113` | When `enforce_geofence=True` and a user is outside the radius, `clock_in` raises HTTP 403 before saving anything—so HR has no GPS breadcrumb of where the user actually was. |
| Single-shot `getCurrentPosition` with `enableHighAccuracy: true, timeout: 10000, maximumAge: 0` | `EmployeeSelfService.tsx:295, 406` | On mobile phones indoors, cold GNSS satellite lock frequently takes >10s and throws `PositionError.TIMEOUT (code 3)`. Desktop web succeeds via Wi-Fi/IP fallback, while mobile fails if it doesn't fall back to coarse/network location first. |
| `/hrms/travel-routes/live-field-staff` only shows employees with today's trail or attendance | `backend/src/api/v1/hrms/travel_routes.py:773-875` | Once login & session pings write to `EmployeeLocationTrail`, every logged-in employee immediately appears on the **Live Field Staff Radar** with real-time coordinates, speed, and battery level. |

---

## A.1 Architecture: How GPS Tracking Will Work Across Web, Mobile Browser/PWA, and Mobile App

### Core Rule: **Track Always, Enforce Geofence Separately**
1. **Capture Layer (Always-On, Irrespective of GPS Lock):**
   - Triggered automatically the moment **any user logs in** (`login`, `loginWithToken`, `verifyFirstTimeCode`, passkey/face login, or app launch with an active session in `AuthProvider`).
   - Runs globally at the root of the app (`__root.tsx` / `AuthProvider`), **not** locked inside `EmployeeSelfService.tsx`.
   - Captures GPS regardless of whether `enforce_geofence` is ON or OFF, and regardless of whether `punch_method` is `GPS`, `Face`, `Biometric`, or `Web`.
2. **Policy Layer (Geofence Lock):**
   - The "GPS Lock" (`enforce_geofence` + `geofence_radius_meters`) only decides whether an attendance punch is marked `is_geofence_verified = True`, flagged as `off_site`, or blocked—**even when a check-in is blocked by geofence lock, the GPS coordinate is still logged to `EmployeeLocationTrail`** before returning the error.

### Two-Stage Mobile-Resilient GPS Acquisition (`frontend/src/lib/gps-tracker.ts`)
Mobile devices fail when you demand `enableHighAccuracy: true` with `maximumAge: 0` on a cold indoor start. We solve this with a **progressive 2-stage lock + native bridge hook**:

1. **Native Mobile App Bridge Check (Capacitor / Android WebView / iOS WKWebView):**
   - If running inside a Capacitor / React Native / Android WebView wrapper (`window.Capacitor?.Plugins?.Geolocation` or `window.BusinessOSNative?.getLocation`), invoke the native OS location provider first (which also supports `isFromMockProvider` on Android and background location service).
2. **Stage 1 — Instant Coarse/Cached Fix (< 2 seconds on Mobile):**
   - Call `navigator.geolocation.getCurrentPosition` with `{ enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }`.
   - Uses mobile cell-tower / Wi-Fi triangulation to guarantee an immediate login fix indoors.
3. **Stage 2 — High-Accuracy GNSS Refinement (`watchPosition` / Median-of-N):**
   - Immediately upgrade to `navigator.geolocation.watchPosition` with `{ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }`.
   - As the phone's GPS chip warms up (accuracy improves from ~150m → ~8m), send an updated ping to the server.
   - For check-in / face verification (`collectGpsFixes`), collect up to `N = 5` fixes over 6–8 seconds (or stop early as soon as `accuracy <= 20m`) and compute the **median latitude/longitude** to eliminate urban-canyon multipath spikes.

---

## A.2 Lifecycle Events Tracked Automatically

| Event (`activity_type`) | Trigger | What Happens |
|---|---|---|
| `"login"` | User signs in (password, OTP, passkey, or face) | Captures Stage-1 fast GPS immediately + Stage-2 refined GPS 5s later → `POST /hrms/travel-routes/ping` |
| `"session_start"` | User opens app / refreshes tab while already logged in | Captures current GPS on mount (throttled to once per 2 min across reloads) |
| `"app_resume"` | Mobile user unlocks phone or switches back to app (`document.visibilityState === "visible"` or `window.focus`) | Captures fresh GPS fix immediately upon returning to foreground |
| `"traveling"` / `"stationary"` | Continuous background/foreground watcher (`watchPosition` + 3-min heartbeat) | Sends ping whenever user moves **≥ 30 meters** OR every **3 minutes** while active; calculates `speed` (km/h) and `activity_type` (`stationary` if < 2 km/h, `walking` if 2–7 km/h, `driving` if > 7 km/h) |
| `"check_in"` / `"check_in_blocked"` | User taps Clock-In (`attendance.py`) | Records `EmployeeLocationTrail` row **before** checking geofence lock so even rejected out-of-geofence punches appear on the admin map |
| `"check_out"` | User taps Clock-Out | Records final shift breadcrumb in `EmployeeLocationTrail` |
| **Offline Queue Sync** | Device loses mobile data (`!navigator.onLine` or network error) | Buffers pings in `localStorage["bos_offline_gps_queue"]` (up to 500 points with device timestamps & battery level) and auto-flushes via `POST /hrms/travel-routes/ping-batch` when `window.ononline` fires |

---

## A.3 Backend Enhancements for Universal Login GPS Tracking

### 1. Relax `/hrms/travel-routes/ping` & `/ping-batch` for Non-Employee / Auto-Linked Users (`backend/src/api/v1/hrms/travel_routes.py`)
Currently, `record_location_ping` (`travel_routes.py:118-120`) raises HTTP 400 if `_get_current_employee(db, ctx)` returns `None`.
- **Change:**
  1. In `_get_current_employee`, match by `Employee.user_id == ctx.user.id` OR `func.lower(Employee.email) == func.lower(ctx.user.email)`. If matched by email and `employee.user_id is None`, auto-heal `employee.user_id = ctx.user.id`.
  2. If the logged-in user is an Admin/Owner without an `Employee` row yet, either allow `employee_id` to be nullable on `EmployeeLocationTrail` (adding `user_id: Mapped[uuid.UUID | None]` to `EmployeeLocationTrail`) OR return `{ "success": true, "skipped": "no_employee_profile" }` with HTTP 200 instead of throwing 400 console errors on every admin login.
  3. Compute distance against the employee's assigned Branch/Scheme coordinates (if configured) and auto-populate `location_name` (e.g., `"Inside HQ Office Geofence (18m)"` or `"Off-Site • 1.4km from HQ Office"`) when `payload.location_name` is not supplied by the client!

### 2. Record GPS Trail in `POST /hrms/attendance/check-in` and `check-out` Irrespective of Geofence Lock (`backend/src/api/v1/hrms/attendance.py`)
- In `clock_in` (`attendance.py:1097`) and `clock_out` (`attendance.py:1192`):
  - **Before** raising `HTTPException(403, "GPS Geofence Restriction...")`, whenever `payload.latitude` and `payload.longitude` are provided, insert an `EmployeeLocationTrail` row and `db.commit()` (or log in a separate transaction) with `activity_type = "check_in"` (if allowed) or `"geofence_blocked"` (if blocked by GPS lock).
  - Add an attendance setting / scheme flag `allow_punch_outside_geofence_as_flagged: bool = True` (optional): allows businesses to choose whether "GPS Lock" **hard-blocks** the punch (403) or **accepts & flags** (`is_geofence_verified = False`, `status = "Present"`, notes = `"Flagged: 420m outside geofence"`) while still recording exact coordinates.

---

## A.4 Frontend & Mobile App Setup for GPS Tracking

### 1. New Service: `frontend/src/lib/gps-tracker.ts`
- `getBestGpsFix(options)` — 2-stage (coarse fast fallback + high-accuracy GNSS refinement) so mobile never hangs or fails indoors.
- `collectGpsFixes({ fixes: 5, maxWaitMs: 7000 })` — median-of-N sampler used by Check-In and Face Verification.
- `readDeviceBattery()` — uses `navigator.getBattery?.()` (supported on Chrome Android / WebView) to attach `battery_level` (0–100%) to every ping.
- `startSessionGpsTracker()` / `stopSessionGpsTracker()` — manages `watchPosition`, movement delta filter (≥ 30m), 3-minute heartbeat timer, `visibilitychange` listener, and offline queue (`bos_offline_gps_queue`) flush via `travelRoutesApi.pingBatch`.

### 2. Global Mounting in `frontend/src/contexts/auth-context.tsx` (or `__root.tsx`)
- Inside `AuthProvider`:
  - When `login()`, `loginWithToken()`, `verifyFirstTimeCode()` succeeds → immediately call `triggerLoginGpsPing("login")`.
  - When `isAuthed && user` is active → start `startSessionGpsTracker()`; when `logout()` is called → call `stopSessionGpsTracker()`.
  - If permission is `prompt` or `denied` on mobile, display a non-intrusive mobile banner / prompt explaining how to allow location access in browser/app settings, with a 1-tap **"Enable GPS Signal"** button (satisfies iOS Safari user-gesture requirement).

### 3. Mobile PWA + Native Wrapper Readiness
- Add `frontend/public/manifest.webmanifest` and meta tags in `frontend/src/routes/__root.tsx` (`apple-mobile-web-app-capable`, `theme-color`, icons) so employees can install BusinessOS AI to their phone home screen.
- Document Capacitor (`capacitor.config.ts`) / Android WebView configuration for native background location (`ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `FOREGROUND_SERVICE_LOCATION`) pointing directly at the same `/hrms/travel-routes/ping` and `/ping-batch` endpoints.

---
---

# PART B: HRMS Facial-Recognition Login & Check-In — Single-Shot Implementation Plan

Goal: an employee logs into the app (PWA / mobile WebView / web) **with their face** —
the browser computes a face embedding on-device (like a phone's Face ID never ships
the raw face for matching, only the vector) — the server does a 1:N match against enrolled templates,
runs a liveness challenge with landmark telemetry verification, captures **median-of-N GPS coordinates** (via Part A's `gps-tracker.ts`),
scores the whole event for fraud, and completes an attendance **check-in**.

Design principle throughout: **face is one factor, never the sole gate.**
Score = face match + liveness + GPS heuristics + IP cross-check + clock drift →
`approved | video_required | flagged | rejected`.

---

## 0. What already exists (do NOT rebuild)

| Existing | Location | Use for |
|---|---|---|
| `User.face_descriptor` / `Employee.face_descriptor` TEXT + `face_photo` | `models/__init__.py` User :147-150, Employee :952-958 | Back-compat only; real vectors go to `FaceTemplate` |
| `FaceRecognitionLog` (employee_id, confidence, location, action, status) | `models/__init__.py` :1124-1134 | Compat log — still written on every face event (convert cosine distance → 0–100% confidence) |
| `POST /hrms/face/register`, `GET /hrms/face/status`, `DELETE /hrms/face/me` | `hrms/attendance.py` :1403/:1473/:1522 | Keep working; new enroll API is separate and extends `/face/status` |
| `POST /hrms/attendance/check-in` with GPS + haversine + Branch geofence + `is_geofence_verified` + audit log | `hrms/attendance.py` :1011-1189 | Face check-in layers ON TOP of this endpoint |
| `AttendanceRecord` DB-only cols `check_in_selfie_url`, `check_out_selfie_url`, `is_face_verified`, `is_wfh` | `init_db.py` :593-598 | **Add missing `Mapped[...]` fields to `AttendanceRecord` in `models/__init__.py`** so ORM persists them |
| `EmployeeLocationTrail` + `POST /hrms/travel-routes/ping` & `/ping-batch` | `models/__init__.py` :1078-1108, `hrms/travel_routes.py` :108-229 | Used by Part A for login + continuous session GPS trail |
| Broken: frontend `createFaceLog` → `POST /hrms/attendance/face-logs` has NO backend route | `api-client.ts` :1543 | **Fix as part of this work** |
| Passkey / fingerprint → `_build_token_response` → `TokenResponse` auth pattern | `auth.py` :1154-1211, :1332-1446, helper :80-165 | Face-login endpoint mirrors this exactly |
| LiveKit token minting (`generate_livekit_token`), settings | `services/telephony_service.py` :47-55, `settings.py` :137-144 | Optional "video proof" layer |
| Frontend stubs: "Face" method text in `EmployeeSelfService.tsx`, simulate button in `AttendanceManagement.tsx`, WebAuthn helpers in `lib/webauthn.ts` | see file map | Replace stubs with real camera flow |

---

## 1. Recognition engine (Corrected Browser ML Stack)

> [!IMPORTANT]
> **Why this section was updated:** `@mediapipe/tasks-vision` provides `FaceDetector` and `FaceLandmarker` (478 3D landmarks + 52 blendshapes, ideal for **liveness**), but it **does not have a `FaceEmbedder` task**. For true metric face-recognition embeddings in the browser, we pair MediaPipe `FaceLandmarker` (for fast detection + 3D liveness) with **`@vladmandic/face-api` (128-d ResNet-34 metric face descriptor)** or **`onnxruntime-web` running InsightFace MobileFaceNet (`w600k_mbf.onnx`, 512-d)** behind a versioned vector interface.

**On-device embedding in the browser, server stores only vectors.**

| Item | Choice | Why |
|---|---|---|
| Detection & 3D Liveness | MediaPipe `FaceLandmarker` (`@mediapipe/tasks-vision` 0.10.x, ~478 3D landmarks + 52 blendshapes) | 30–80 ms/frame on mobile, best iOS Safari story, gives exact eye-blink blendshapes & 3D head pose yaw/pitch |
| Metric Face Embedding (Default) | `@vladmandic/face-api` (`face_recognition_model` ResNet-34 → **128-d** L2-normalized vector, ~6 MB self-hosted) | Pure WebGL/WASM, zero Python native C++ build dependencies, ~0.5 KB/vector, accurate up to several hundred employees per tenant |
| Accuracy Upgrade Path (Drop-in) | InsightFace MobileFaceNet (`w600k_mbf.onnx`, **512-d** L2-normalized vector, ~13 MB) via `onnxruntime-web` on 112×112 aligned crop from MediaPipe 5 keypoints | `FaceTemplate.model_name` + `embedding_dim` version every row so 128-d and 512-d models can swap without schema changes |
| Model Hosting | Self-hosted under `frontend/public/models/face/` (`face_landmarker.task` + recognition weights), with CDN fallback if local model files are not yet downloaded | Works offline/on-prem and avoids CORS breakage |
| Match Math | Cosine distance ($1 - \mathbf{u}\cdot\mathbf{v}$) on L2-normalized vectors, brute-force `numpy` over tenant's ACTIVE templates filtered by `model_name` ($N < 5,000 \rightarrow < 1\text{ ms}$, **no pgvector extension needed**). `ARRAY(Float)` (`float8[]`) column stores vectors | Keeps Postgres vanilla per house style |

**Enrollment (per phone-grade practice):**
- 3–5 samples minimum (up to 10 max); wizard forces **center + ~±15° yaw** (3 angles: Center, Look Slightly Left, Look Slightly Right), quality gate per sample: exactly 1 face, detection conf > 0.6, landmark sharpness, face ≥ 35% of frame.
- Store **$k = 3\text{--}10$ individual vectors per person** (one `FaceTemplate` row each), NOT a single mean.
- Match rule:
  - Let $d_1$ (`top_score`) be the **smallest** cosine distance (best match user) and $d_2$ (`runner_up`) be the **second smallest** cosine distance (from a *different* user).
  - **Auto-accept only if $d_1 < \text{threshold}$ AND margin $(d_2 - d_1) \ge 0.06$** (or if only 1 user is enrolled in the tenant, $d_1 < \text{threshold}$); otherwise `ambiguous → flagged`.
- Default thresholds (settings, tunable):
  - For 128-d (`face-api-resnet34-v1`) / 512-d (`mobilefacenet-v1`): `FACE_1N_THRESHOLD = 0.40`, `FACE_1TO1_THRESHOLD = 0.45`, `FACE_MIN_MARGIN = 0.06`, `FACE_MAX_SAMPLES = 10`.
- **Calibration tool** (Phase 5): for each enrolled user, score their $k$ vectors against all other users' vectors (impostor set) + their own alternate samples (genuine set); print FMR@threshold; retune to FMR ≈ 0.1%.

**Liveness (with Server-Side Telemetry Verification):**
- `POST /hrms/face/challenge` issues a **random action** per session from `{blink, look_left, look_right, smile}` + one-time UUID nonce + expiry (cached in Redis for 5 min with in-memory fallback).
- Client verifies from the 3D-landmark / blendshape stream AND collects **telemetry proof**:
  - `frames_analyzed` ($\ge 15$ frames over $\ge 1.5\text{ s}$ continuous single-face detection)
  - `pose_delta_deg` ($\ge 2.5^\circ$ natural micro-movement across frames — defeats static printed photo)
  - `peak_metric` (e.g., `eyeBlinkLeft/Right > 0.45` or `EAR < 0.20` for `blink`; `mouthSmileLeft/Right > 0.50` for `smile`; `|yaw_deg| > 12°` for `look_left`/`look_right`).
- **Server validates the telemetry metrics against the issued challenge** (does not blindly trust `passed: true`) and consumes the single-use nonce.

**Security & Storage Posture:**
- Template store (`FaceTemplate`) holds **vectors only, never face images.**
- Audit selfie (if captured) is compressed client-side to a 320×240 WebP/JPEG data URL (~12–18 KB) or saved to local static uploads (`uploads/face_selfies/`) with a 30–90 d retention cleanup job — **no external MinIO dependency required**.
- Consent checkbox at enrollment (biometric = sensitive data; BIPA/EU-GDPR/India-DPDP posture).
- Revocation: on resignation/termination, exit-management flow sets all user's `FaceTemplate.status = "INACTIVE"` (instant 1:N exclusion).
- Tenant-scoped every query; add new tables to `purge.py`.

---

## 2. Backend changes

### 2.1 Update `AttendanceRecord` & Add New Models in `backend/src/models/__init__.py` (SQLAlchemy 2.0 `Mapped` style)

First, add the 4 existing DB columns to `AttendanceRecord` (`models/__init__.py:1010`):
```python
    is_face_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_wfh: Mapped[bool] = mapped_column(Boolean, default=False)
    check_in_selfie_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    check_out_selfie_url: Mapped[str | None] = mapped_column(Text, nullable=True)
```

Second, add `FaceTemplate` and `FaceCheckInAttempt` using house SQLAlchemy 2.0 `Mapped` conventions:
```python
class FaceTemplate(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "face_templates"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True)
    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True, index=True)
    embedding: Mapped[list[float]] = mapped_column(ARRAY(Float), nullable=False)
    embedding_dim: Mapped[int] = mapped_column(Integer, default=128)
    model_name: Mapped[str] = mapped_column(String(50), default="face-api-resnet34-v1")
    sample_index: Mapped[int] = mapped_column(Integer, default=0)  # 0..k-1
    pose_label: Mapped[str | None] = mapped_column(String(30), nullable=True)  # center | left | right
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")  # ACTIVE | INACTIVE
    consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    consent_version: Mapped[str] = mapped_column(String(20), default="v1")


class FaceCheckInAttempt(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "face_check_in_attempts"

    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    employee_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True)
    matched_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    matched_employee_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    action: Mapped[str] = mapped_column(String(20), default="check-in")  # login | check-in | check-out
    top_score: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)   # cosine distance d1 (lower = better)
    runner_up: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)   # cosine distance d2
    margin: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)      # d2 - d1
    liveness_challenge: Mapped[str | None] = mapped_column(String(20), nullable=True)
    liveness_passed: Mapped[bool] = mapped_column(Boolean, default=False)
    gps_lat: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    gps_lng: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    gps_accuracy_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    gps_fixes: Mapped[int | None] = mapped_column(Integer, default=1)
    distance_from_site_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ip_city: Mapped[str | None] = mapped_column(String(60), nullable=True)
    ip_country: Mapped[str | None] = mapped_column(String(60), nullable=True)
    server_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    client_time_ms: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    tz_offset_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    drift_ms: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    fraud_flags: Mapped[list[str]] = mapped_column(JSONB, default=list)  # ["off_site","fast_travel","clock_drift","low_margin"]
    fraud_score: Mapped[int] = mapped_column(Integer, default=0)         # 0-100 composite risk score
    verdict: Mapped[str] = mapped_column(String(20), default="rejected") # approved | video_required | flagged | rejected
    selfie_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    attendance_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("attendance_records.id", ondelete="SET NULL"), nullable=True)
```

Tables are created by `Base.metadata.create_all` at boot (`init_db.py:147`) + explicit `CREATE TABLE IF NOT EXISTS` in `init_db.py`. Add both to `backend/src/database/purge.py`.

### 2.2 New router — `backend/src/api/v1/hrms/face_recognition.py`

Register in `backend/src/api/v1/router.py` right alongside `attendance_router`.

| Endpoint | Behavior |
|---|---|
| `POST /hrms/face/challenge` | Issues `{ challenge: "blink\|look_left\|look_right\|smile", nonce (uuid, single-use, 5 min TTL), expires_at }`. Public/semi-public (works before login for `/auth/face/login` as well as authenticated check-in). |
| `POST /hrms/face/enroll` | `{ embedding, sample_index, pose_label, model_name, consent: true, liveness {challenge, nonce, passed, telemetry}, selfie_base64? }` — validates nonce & liveness, checks 1:1 against existing vectors on re-enroll (unless admin override), inserts `FaceTemplate`, updates `Employee.punch_method="Face"` + `face_registered_at`. Replaces oldest sample if count > `FACE_MAX_SAMPLES`. |
| `POST /hrms/face/verify` | **The core.** `{ embedding, model_name, liveness {challenge, nonce, passed, telemetry}, gps {lat, lng, accuracy_m, fixes, battery_level}, client_time_ms, tz_offset_ms, selfie_base64?, action }` → runs §2.3 pipeline, ALSO writes a breadcrumb to `EmployeeLocationTrail` (Part A integration) and `FaceRecognitionLog`. Returns `{ attempt_id, verdict, confidence_pct, top_score, margin, fraud_flags, fraud_score, matched_employee, requires_video, livekit_token?, face_recognition_log_id }`. |
| `POST /hrms/attendance/face-logs` | **Fixes the broken frontend call** (`api-client.ts:1543`): wires `FaceRecognitionLogCreate` (`schemas/erp.py:1855`) to insert a `FaceRecognitionLog` row (used by "Simulate" + manual entries). |
| `GET /hrms/face/users` | Enrollment roster: per employee — sample count, last enrolled, model version, status (`view:hrms` / `manage:users`). |
| `POST /hrms/face/templates/{user_id}/deactivate` | Deactivates all templates for a user/employee (`manage:users`; also auto-called from exit-management). |
| `GET /hrms/face/audit?verdict=&from=&to=` | Attempts list for managers/HR (`view:hrms` self-scoped, `manage:users` full). |
| `GET /hrms/face/calibrate` | Impostor/genuine scoring across enrolled templates → FMR/FNR report (`manage:users`). |

Extend `GET /hrms/face/status` (`attendance.py:1473`) to also return `sample_count`, `model_name`, `thresholds` so the UI shows enrollment health.

### 2.3 `POST /hrms/face/verify` pipeline (order matters)

1. Load ACTIVE `FaceTemplate` rows for tenant (matching `model_name`), `numpy` L2-normalize once, compute cosine distances ($1 - \mathbf{u}\cdot\mathbf{v}$) vs incoming vector. Group by `user_id` (take each user's minimum distance across their $k$ samples) → best user distance $d_1$ (`top_score`), second-best user distance $d_2$ (`runner_up`), and `margin = d2 - d1`.
2. **Liveness check**: verify nonce is valid & unconsumed; validate client `telemetry` (`frames_analyzed >= 10`, `pose_delta_deg >= 1.5`, challenge metric threshold met).
3. **Timestamps**: `server_time = datetime.now(timezone.utc)`. `drift_ms = abs(client_time_ms - int(server_time.timestamp() * 1000))`; flag `clock_drift` if `drift_ms > 60_000`.
4. **GPS heuristics + Always-On Trail Logging** (even if outside geofence!):
   - Write an `EmployeeLocationTrail` breadcrumb immediately with `activity_type = f"face_{payload.action}"`.
   - Haversine vs employee's Branch/Scheme site (`Branch.latitude/longitude/geofence_radius_meters`) → flag `off_site` if outside radius (unless WFH).
   - Claimed `accuracy_m < 15` but position `> 200 m` from site → `accuracy_mismatch`.
   - Previous trail/punch → this punch implied speed `> 80 km/h` → `fast_travel`.
5. **Composite fraud risk score (0–100, lower is cleaner)**:
   - Face distance penalty (0–40) + Liveness penalty (0–25) + GPS penalty (0–20) + Drift penalty (0–10) + Margin penalty (0–5).
6. **Verdict:**
   - `approved` — $d_1 < \text{threshold}$, margin $\ge 0.06$ (or single enrolled user), liveness passed, not `off_site` (or geofence not enforced).
   - `video_required` — borderline face distance OR `off_site`/`fast_travel` when `face_flag_to_video` is enabled.
   - `flagged` — face matched ($d_1 < \text{threshold}$) and liveness passed, but `low_margin`, `off_site`, or `clock_drift` flagged (allows check-in with manager review or override).
   - `rejected` — no face match ($d_1 \ge \text{threshold}$) or liveness/nonce failed.
7. Persist `FaceCheckInAttempt` + legacy `FaceRecognitionLog` (`confidence = round(max(0, (1 - d1) * 100), 2)`), `write_audit_log`.

### 2.4 Face-enabled check-in — extend `POST /hrms/attendance/check-in` (`:1011`) and `check-out` (`:1192`)

Add to `ClockInRequest` and `ClockOutRequest` (`schemas/erp.py:1560`):
```python
face_attempt_id: uuid.UUID | None = None
face_confidence: float | None = None
ack_flagged: bool = False
```
In the handler:
- Always record the incoming GPS coordinates into `EmployeeLocationTrail` (Part A guarantee).
- If `face_attempt_id` is passed: load `FaceCheckInAttempt`, verify it belongs to this tenant/employee, and set `att.is_face_verified = (attempt.verdict == "approved")`, `att.check_in_selfie_url = attempt.selfie_url`, `att.method = "Face"`, and link `attempt.attendance_id = att.id`.

### 2.5 Face **login** (no password) — `backend/src/api/v1/auth.py`

```
POST /auth/face/login
  { identifier (email/phone), tenant_slug?,
    embedding, model_name, liveness{challenge, nonce, passed, telemetry},
    gps?: {lat, lng, accuracy_m, battery_level} }
```
- Resolve `User` by `identifier` → load their ACTIVE `FaceTemplate` rows → 1:1 match against their $k$ vectors ($\min d < \text{FACE\_1TO1\_THRESHOLD}$), validate & consume liveness nonce.
- If `gps` is provided in the login payload, immediately record an `EmployeeLocationTrail(activity_type="face_login")` row!
- Log `FaceCheckInAttempt(action="login", verdict="approved")` + `write_audit_log`.
- Return `await _build_token_response(db, user, request)` → standard `TokenResponse` consumed by `useAuth().loginWithToken`.

---

## 3. Master Build Sequence (Part A GPS First, Then Part B Face Recognition)

### Phase 1 — Solid Web & Mobile GPS Tracking (Part A)
1. **Backend GPS Trail Hardening (`travel_routes.py` & `attendance.py`)**:
   - Auto-link `Employee` by email in `_get_current_employee`, handle non-employee admin logins gracefully without 400 errors, auto-compute distance from branch & human-readable `location_name` on `/hrms/travel-routes/ping`.
   - Log `EmployeeLocationTrail` in `clock_in` and `clock_out` **before** geofence lock 403 checks so out-of-geofence attempts are still captured on the map.
2. **Frontend Universal GPS Engine (`frontend/src/lib/gps-tracker.ts`)**:
   - Build 2-stage mobile-first acquisition (fast coarse fix + high-accuracy GNSS `watchPosition` refinement + `collectGpsFixes` median-of-N), battery reader, offline `localStorage` queue + `pingBatch` sync, and native app bridge hook (`window.Capacitor` / `window.BusinessOSNative`).
3. **Global Login & Session Hook (`frontend/src/contexts/auth-context.tsx` & `manifest.webmanifest`)**:
   - Trigger immediate GPS ping on every login (`login`, `loginWithToken`, `verifyFirstTimeCode`), run session watcher while authenticated (`app_resume` on mobile `visibilitychange` + movement/heartbeat pings), and add PWA manifest for mobile installation.

### Phase 2 — Facial Recognition Engine & Check-In (Part B)
4. **DB & Models (`models/__init__.py`, `init_db.py`, `purge.py`)**:
   - Map `is_face_verified`, `is_wfh`, `check_in_selfie_url`, `check_out_selfie_url` on `AttendanceRecord`.
   - Add `FaceTemplate` and `FaceCheckInAttempt` models.
5. **Backend Face Router & Auth (`hrms/face_recognition.py`, `attendance.py`, `auth.py`, `settings.py`)**:
   - Implement `/hrms/face/challenge`, `/enroll`, `/verify`, `/users`, `/templates/{user_id}/deactivate`, `/audit`, `/calibrate`, fix `POST /hrms/attendance/face-logs`, extend `/hrms/face/status`, extend `check-in`/`check-out`, and add `POST /auth/face/login`.
   - Hook exit-management (`hrms/exit_management.py` or employee deactivation) to set `FaceTemplate.status = "INACTIVE"`.
6. **Frontend Face ML & UI (`frontend/src/lib/face/*`, `FaceEnrollmentWizard.tsx`, `FaceCheckIn.tsx`, `EmployeeSelfService.tsx`, `AttendanceManagement.tsx`, `login.tsx`)**:
   - Implement camera + quality gate + liveness challenge + descriptor extraction + median-of-N GPS check-in card, enrollment wizard, Face Login button on `login.tsx`, and live Face Audit & Enrollment Roster in `AttendanceManagement.tsx`.
