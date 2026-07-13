import os

target = os.path.join("backend", "src", "api", "v1", "erp", "erp_system.py")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

target_block = """@router.get("/system-settings", response_model=list[SystemSettingResponse])
async def get_system_settings(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    category: str | None = None,
):
    \"\"\"Retrieve all system settings for the current tenant.\"\"\"
    query = select(SystemSetting).where(SystemSetting.tenant_id == ctx.tenant_id)
    if category:
        query = query.where(SystemSetting.category == category)
    result = await db.execute(query.order_by(SystemSetting.category, SystemSetting.key))
    return result.scalars().all()"""

replacement_block = """DEFAULT_SETTINGS_SEED = {
    "default_currency": ("INR", "general", "Default Currency", True),
    "default_timezone": ("Asia/Kolkata", "general", "Default Timezone", True),
    "system_language": ("en", "general", "System Language", True),
    "date_format": ("YYYY-MM-DD", "general", "Date Format", True),
    "enable_gst_vat": ("true", "general", "Enable GST / VAT Tracking", True),
    "strict_fy_locking": ("false", "general", "Strict Financial Year Locking", True),
    "mfa_required": ("false", "security", "Require MFA for all users", True),
    "session_timeout_hours": ("12", "security", "Session Timeout (hours)", True),
    "password_expiry_days": ("90", "security", "Password Expiry (days)", True),
    "email_notifications": ("true", "notifications", "Email Notifications", True),
    "sms_notifications": ("false", "notifications", "SMS Notifications", True),
    "primary_color": ("#6366f1", "branding", "Primary Brand Color", True),
    "company_logo_url": ("", "branding", "Company Logo URL", True),
    "backup_frequency": ("daily", "data", "Backup Frequency", True),
    "data_retention_days": ("30", "data", "Data Retention (days)", True),
}


@router.get("/system-settings", response_model=list[SystemSettingResponse])
async def get_system_settings(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    category: str | None = None,
):
    \"\"\"Retrieve all system settings for the current tenant. Auto-seeds defaults if missing.\"\"\"
    # 1. Fetch current settings
    query = select(SystemSetting).where(SystemSetting.tenant_id == ctx.tenant_id)
    result = await db.execute(query)
    existing_settings = result.scalars().all()
    existing_keys = {s.key for s in existing_settings}

    # 2. Seed missing settings
    seeded = False
    for key, (val, cat, desc, is_pub) in DEFAULT_SETTINGS_SEED.items():
        if key not in existing_keys:
            setting = SystemSetting(
                tenant_id=ctx.tenant_id,
                key=key,
                value=val,
                category=cat,
                description=desc,
                is_public=is_pub,
            )
            db.add(setting)
            seeded = True

    if seeded:
        await db.commit()
        # Re-fetch
        result = await db.execute(
            select(SystemSetting).where(SystemSetting.tenant_id == ctx.tenant_id)
        )
        existing_settings = result.scalars().all()

    # Filter by category if requested
    if category:
        filtered = [s for s in existing_settings if s.category == category]
    else:
        filtered = list(existing_settings)

    # Sort
    filtered.sort(key=lambda s: (s.category, s.key))
    return filtered"""

if target_block.replace("\r\n", "\n") in content.replace("\r\n", "\n"):
    line_ending = "\r\n" if "\r\n" in content else "\n"
    target_block_file = target_block.replace("\n", line_ending)
    replacement_block_file = replacement_block.replace("\n", line_ending)
    content = content.replace(target_block_file, replacement_block_file)
    with open(target, "w", encoding="utf-8", newline="") as f:
        f.write(content)
    print("Updated get_system_settings in erp_system.py successfully")
else:
    print("Could not find Target Content in erp_system.py")
