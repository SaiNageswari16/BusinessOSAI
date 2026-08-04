import os
import re

files = [
    "CustomerDocuments.tsx",
    "Opportunities.tsx",
    "Deals.tsx",
    "SalesPipeline.tsx",
    "Quotations.tsx",
    "SalesOrders.tsx"
]

base_path = r"c:\Users\Admin\Desktop\NEW FOLDER\frontend\src\components\crm"

for f in files:
    filepath = os.path.join(base_path, f)
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        continue
    
    with open(filepath, "r", encoding="utf-8") as file:
        content = file.read()
    
    # Add toast import if missing
    if 'import { toast } from "sonner";' not in content:
        content = 'import { toast } from "sonner";\n' + content
        
    # Find all <button ...> and add onClick if missing
    content = re.sub(
        r"<button(?![^>]*onClick)[^>]*className=",
        r"<button onClick={() => toast.info('Feature coming soon!')} className=",
        content
    )
    
    with open(filepath, "w", encoding="utf-8") as file:
        file.write(content)
        
print("Buttons updated.")
