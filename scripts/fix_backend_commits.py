import os

# 1. Update leaves.py to refresh after commit
leaves_path = os.path.join("backend", "src", "api", "v1", "hrms", "leaves.py")
with open(leaves_path, "r", encoding="utf-8") as f:
    leaves_content = f.read()

line_ending = "\r\n" if "\r\n" in leaves_content else "\n"

# Replace commit and return in create_leave_request
old_create_commit = """    await db.commit()
    
    # Return mapping with name
    return LeaveRequestResponse("""

new_create_commit = """    await db.commit()
    await db.refresh(leave)
    
    # Return mapping with name
    return LeaveRequestResponse("""

leaves_content = leaves_content.replace(old_create_commit.replace("\n", line_ending), new_create_commit.replace("\n", line_ending))

# Replace commit and return in review_leave_request
old_review_commit = """    await db.commit()
    
    emp = await db.scalar(select(Employee).where(Employee.id == leave.employee_id))
    return LeaveRequestResponse("""

new_review_commit = """    await db.commit()
    await db.refresh(leave)
    
    emp = await db.scalar(select(Employee).where(Employee.id == leave.employee_id))
    return LeaveRequestResponse("""

leaves_content = leaves_content.replace(old_review_commit.replace("\n", line_ending), new_review_commit.replace("\n", line_ending))

# Replace commit and return in create_leave_policy
old_policy_commit = """    await db.commit()
    return policy"""

new_policy_commit = """    await db.commit()
    await db.refresh(policy)
    return policy"""

leaves_content = leaves_content.replace(old_policy_commit.replace("\n", line_ending), new_policy_commit.replace("\n", line_ending))

with open(leaves_path, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(leaves_content)
print("Updated backend leaves.py router with db.refresh calls successfully")


# 2. Update payroll.py to refresh after commit
payroll_path = os.path.join("backend", "src", "api", "v1", "hrms", "payroll.py")
with open(payroll_path, "r", encoding="utf-8") as f:
    payroll_content = f.read()

# Replace commit and return in create_pay_grade
old_grade_commit = """    await db.commit()
    
    return PayGradeResponse("""

new_grade_commit = """    await db.commit()
    await db.refresh(grade)
    
    return PayGradeResponse("""

payroll_content = payroll_content.replace(old_grade_commit.replace("\n", line_ending), new_grade_commit.replace("\n", line_ending))

with open(payroll_path, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(payroll_content)
print("Updated backend payroll.py router with db.refresh calls successfully")
