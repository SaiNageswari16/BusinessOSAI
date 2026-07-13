import os

target = os.path.join("backend", "src", "schemas", "erp.py")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

target_block = """class AuditLogResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    user_id: uuid.UUID | None
    module: str
    action: str
    entity_type: str | None
    entity_id: uuid.UUID | None
    old_values: dict | None
    new_values: dict | None
    ip_address: str | None
    user_agent: str | None
    status: str
    created_at: datetime"""

replacement_block = """class AuditLogResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    user_id: uuid.UUID | None
    module: str
    action: str
    entity_type: str | None
    entity_id: uuid.UUID | None
    old_values: dict | None
    new_values: dict | None
    ip_address: str | None
    user_agent: str | None
    status: str
    created_at: datetime
    user_name: str | None = None
    user_email: str | None = None"""

# Check normalized text matching (to bypass CRLF vs LF issues)
if target_block.replace("\r\n", "\n") in content.replace("\r\n", "\n"):
    # Determine the line endings of the file
    line_ending = "\r\n" if "\r\n" in content else "\n"
    target_block_file = target_block.replace("\n", line_ending)
    replacement_block_file = replacement_block.replace("\n", line_ending)
    content = content.replace(target_block_file, replacement_block_file)
    with open(target, "w", encoding="utf-8", newline="") as f:
        f.write(content)
    print("Updated AuditLogResponse in schemas/erp.py successfully")
else:
    print("Could not find Target Content in schemas/erp.py")
