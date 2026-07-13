import os

target = os.path.join("frontend", "src", "lib", "api-client.ts")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

target_block = """export interface AuditLog {
  id: string;
  tenant_id: string;
  user_id: string | null;
  module: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  status: string;
  created_at: string;
}"""

replacement_block = """export interface AuditLog {
  id: string;
  tenant_id: string;
  user_id: string | null;
  module: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  status: string;
  created_at: string;
  user_name?: string | null;
  user_email?: string | null;
}"""

if target_block.replace("\r\n", "\n") in content.replace("\r\n", "\n"):
    line_ending = "\r\n" if "\r\n" in content else "\n"
    target_block_file = target_block.replace("\n", line_ending)
    replacement_block_file = replacement_block.replace("\n", line_ending)
    content = content.replace(target_block_file, replacement_block_file)
    with open(target, "w", encoding="utf-8", newline="") as f:
        f.write(content)
    print("Updated AuditLog interface successfully")
else:
    print("Could not find Target Content in api-client.ts")
