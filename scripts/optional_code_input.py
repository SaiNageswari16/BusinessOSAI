import os

target = os.path.join("frontend", "src", "components", "hrms", "EmployeeManagement.tsx")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

# Locate the employee code input block
old_input_block = """                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Employee Code *</label>
                  <Input value={formData.employee_code} onChange={e => setFormData(p => ({ ...p, employee_code: e.target.value.toUpperCase() }))} placeholder="e.g. EMP-101" required disabled={!!editingEmployee} />
                </div>"""

new_input_block = """                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Employee Code (Optional)</label>
                  <Input value={formData.employee_code} onChange={e => setFormData(p => ({ ...p, employee_code: e.target.value.toUpperCase() }))} placeholder="Leave blank for auto-gen" disabled={!!editingEmployee} />
                </div>"""

if old_input_block in content:
    content = content.replace(old_input_block, new_input_block)
    with open(target, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(content)
    print("Made Employee Code input field optional in dialog")
else:
    # If indentation is slightly different, let's do a more robust replace
    print("Could not find the target code input block exactly")
