import os

target = os.path.join("frontend", "src", "lib", "api-client.ts")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

target_block = """export interface Employee {
  id: string;
  tenant_id: string;
  user_id: string | null;
  company_id: string;
  branch_id: string | null;
  department_id: string | null;
  designation_id: string | null;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
  date_of_joining: string | null;
  employment_type: string;
  gender: string | null;
  marital_status: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  bank_account: string | null;
  ifsc_code: string | null;
  pan_number: string | null;
  aadhar_number: string | null;
  basic_salary: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}"""

replacement_block = """export interface Employee {
  id: string;
  tenant_id: string;
  user_id: string | null;
  company_id: string;
  branch_id: string | null;
  department_id: string | null;
  designation_id: string | null;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
  date_of_joining: string | null;
  employment_type: string;
  gender: string | null;
  marital_status: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  bank_account: string | null;
  ifsc_code: string | null;
  pan_number: string | null;
  aadhar_number: string | null;
  basic_salary: number | null;
  status: string;
  created_at: string;
  updated_at: string;
  temporary_password?: string;
}"""

if target_block in content:
    content = content.replace(target_block, replacement_block)
    with open(target, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(content)
    print("Added temporary_password to Employee interface in client")
else:
    print("Could not find Target Block in client file")
