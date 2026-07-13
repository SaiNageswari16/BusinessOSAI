import os

target = os.path.join("frontend", "src", "components", "hrms", "AttendanceManagement.tsx")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

# Replace button conditional block to check activeRole name
old_button_block = """        {user?.is_tenant_owner && (
          <div className="flex gap-2">
            <Button variant="outline" className="h-9 border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/10" onClick={handleClockIn}>
              WFH Clock In
            </Button>
            <Button variant="outline" className="h-9 border-red-500/20 text-red-600 hover:bg-red-500/10" onClick={handleClockOut}>
              WFH Clock Out
            </Button>
          </div>
        )}"""

new_button_block = """        {(() => {
          const activeRole = user?.roles.find(r => r.id === user?.activeRoleId);
          const isAdmin = activeRole ? (activeRole.name.toLowerCase().includes("admin") || activeRole.name.toLowerCase().includes("hr")) : user?.isTenantOwner;
          if (!isAdmin) return null;
          return (
            <div className="flex gap-2">
              <Button variant="outline" className="h-9 border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/10" onClick={handleClockIn}>
                WFH Clock In
              </Button>
              <Button variant="outline" className="h-9 border-red-500/20 text-red-600 hover:bg-red-500/10" onClick={handleClockOut}>
                WFH Clock Out
              </Button>
            </div>
          );
        })()}"""

line_ending = "\r\n" if "\r\n" in content else "\n"
content = content.replace(old_button_block.replace("\n", line_ending), new_button_block.replace("\n", line_ending))

with open(target, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(content)

print("Updated AttendanceManagement.tsx WFH buttons with active role check successfully")
