import os

target = os.path.join("frontend", "src", "lib", "api-client.ts")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

target_block = """  get: (id: string) => request<Employee>("GET", `/hrms/employees/${id}`),"""

replacement_block = """  getMe: () => request<Employee>("GET", "/hrms/employees/me"),
  get: (id: string) => request<Employee>("GET", `/hrms/employees/${id}`),"""

if target_block in content:
    content = content.replace(target_block, replacement_block)
    with open(target, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(content)
    print("Added getMe to api-client.ts successfully")
else:
    print("Could not find Target Block in api-client.ts")
