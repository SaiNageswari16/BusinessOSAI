import os

target = os.path.join("backend", "src", "utils", "security.py")

NEW_CONTENT = """import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.models import Permission, Role, RolePermission

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DEFAULT_PERMISSIONS: list[tuple[str, str, str, str]] = [
    ("view:dashboard", "View Dashboard", "core", "Access main dashboard"),
    ("view:copilot", "View AI Copilot", "core", "Access AI assistant"),
    ("view:erp", "View Core ERP", "erp", "Access ERP module"),
    ("manage:erp", "Manage Core ERP", "erp", "Full management of ERP settings and components"),
    ("view:inventory", "View Inventory", "inventory", "Access inventory module"),
    ("view:warehouse", "View Warehouse", "warehouse", "Access warehouse module"),
    ("view:procurement", "View Procurement", "procurement", "Access procurement module"),
    ("view:pos", "View POS", "pos", "Access point of sale"),
    ("view:accounting", "View Accounting", "accounting", "Access accounting module"),
    ("view:crm", "View CRM", "crm", "Access CRM module"),
    ("view:hrms", "View HRMS", "hrms", "Access HRMS module"),
    ("view:payroll", "View Payroll", "payroll", "Access payroll module"),
    ("view:reports", "View Reports", "reports", "Access reports"),
    ("view:settings", "View Settings", "settings", "Access system settings"),
    ("manage:users", "Manage Users", "erp", "Create and manage users"),
    ("manage:roles", "Manage Roles", "erp", "Create and manage roles"),
    ("manage:companies", "Manage Companies", "erp", "Create and manage companies"),
    ("manage:branches", "Manage Branches", "erp", "Create and manage branches"),
    ("manage:accounting", "Manage Accounting", "accounting", "Create and manage accounting entries"),
    ("manage:audit", "Manage Audit", "system", "Manage and view audit logs"),
    ("view:audit", "View Audit", "system", "View audit logs"),
    # Financial ERP permissions — used by fiscal-years, currencies, taxes, payment-terms, cost-centers, number-series
    ("view:financials", "View Financials", "erp", "Access fiscal years, currencies, tax configs, payment terms"),
    ("manage:financials", "Manage Financials", "erp", "Create/edit fiscal years, currencies, tax configs, payment terms"),
    # Access control permissions — used by roles/permissions management endpoints
    ("view:access_control", "View Access Control", "erp", "View roles, permissions, and user role assignments"),
    ("manage:access_control", "Manage Access Control", "erp", "Create and manage roles and permissions"),
    # Audit log permissions — used by audit-log endpoints
    ("view:audit_logs", "View Audit Logs", "erp", "Access the system-wide audit trail"),
]


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(*, subject: str, tenant_id: str, permissions: list[str], active_role_id: str | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": subject,
        "tenant_id": tenant_id,
        "permissions": permissions,
        "type": "access",
        "exp": expire,
    }
    if active_role_id:
        payload["active_role_id"] = active_role_id
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token_value() -> str:
    return secrets.token_urlsafe(64)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise ValueError("Invalid or expired token") from exc
    if payload.get("type") != "access":
        raise ValueError("Invalid token type")
    return payload


async def seed_permissions(db: AsyncSession) -> None:
    # 1. Seed all default permissions
    result = await db.execute(select(Permission))
    all_perms = {p.code: p for p in result.scalars().all()}
    
    new_perms_added = False
    for code, name, module, description in DEFAULT_PERMISSIONS:
        if code not in all_perms:
            perm = Permission(code=code, name=name, module=module, description=description)
            db.add(perm)
            all_perms[code] = perm
            new_perms_added = True
            
    if new_perms_added:
        await db.flush()

    # 2. Grant all current database permissions to all existing Super Admin roles
    result = await db.execute(select(Permission))
    db_perms = result.scalars().all()
    
    super_roles_res = await db.execute(select(Role).where(Role.name == "Super Admin"))
    super_roles = super_roles_res.scalars().all()
    
    for r in super_roles:
        existing_rp_res = await db.execute(select(RolePermission.permission_id).where(RolePermission.role_id == r.id))
        existing_pids = {pid for pid in existing_rp_res.scalars().all()}
        
        for p in db_perms:
            if p.id not in existing_pids:
                db.add(RolePermission(role_id=r.id, permission_id=p.id))
    await db.flush()


async def create_super_admin_role(db: AsyncSession, tenant_id) -> Role:
    role = Role(
        tenant_id=tenant_id,
        name="Super Admin",
        description="Full access to all modules and system settings",
        is_system=True,
    )
    db.add(role)
    await db.flush()

    permissions = await db.execute(select(Permission))
    for permission in permissions.scalars().all():
        db.add(RolePermission(role_id=role.id, permission_id=permission.id))
    await db.flush()
    return role
"""

with open(target, "w", encoding="utf-8", newline="\r\n") as f:
    f.write(NEW_CONTENT)
print("Updated security.py successfully")
