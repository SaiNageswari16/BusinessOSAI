import os

target = os.path.join("backend", "src", "api", "v1", "erp", "organization.py")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

import_target = "from src.api.deps import CurrentUserContext, require_permission"
import_replacement = "from src.api.deps import CurrentUserContext, require_permission, require_any_permission"

permission_target = 'Depends(require_permission("view:erp"))'
permission_replacement = 'Depends(require_any_permission("view:erp", "view:hrms"))'

if import_target in content:
    content = content.replace(import_target, import_replacement)
    content = content.replace(permission_target, permission_replacement)
    
    with open(target, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(content)
    print("Updated organization.py endpoints successfully")
else:
    print("Failed to find import_target in organization.py")
