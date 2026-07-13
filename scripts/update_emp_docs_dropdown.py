import os

target = os.path.join("frontend", "src", "components", "hrms", "EmployeeManagement.tsx")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

target_block = """  useEffect(() => {
    if (tab === "employees") loadEmployees();
    else if (tab === "departments") loadDepartmentsTab();
    else if (tab === "designations") loadDesignationsTab();
    else if (tab === "teams") loadTeamsTab();
  }, [tab, loadEmployees, loadDepartmentsTab, loadDesignationsTab, loadTeamsTab]);"""

replacement_block = """  useEffect(() => {
    if (tab === "employees" || tab === "documents") loadEmployees();
    if (tab === "departments") loadDepartmentsTab();
    if (tab === "designations") loadDesignationsTab();
    if (tab === "teams") loadTeamsTab();
  }, [tab, loadEmployees, loadDepartmentsTab, loadDesignationsTab, loadTeamsTab]);"""

line_ending = "\r\n" if "\r\n" in content else "\n"

content = content.replace(target_block.replace("\n", line_ending), replacement_block.replace("\n", line_ending))

with open(target, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(content)

print("Updated EmployeeManagement.tsx documents tab loading successfully")
