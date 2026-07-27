import os

replacements = {
    "BusinessOS AI": "IOTRONCS Retail",
    "BusinessOS Corporation": "IOTRONCS Retail",
    "BusinessOS Enterprise Store": "IOTRONCS Retail Store",
    "BusinessOS Enterprise": "IOTRONCS Retail",
    "BusinessOS Copilot": "IOTRONCS Retail Copilot",
    "BusinessOS Global": "IOTRONCS Retail Global",
    "BusinessOS": "IOTRONCS Retail"
}

for root, dirs, files in os.walk(r"c:\Users\Admin\Desktop\E-Commerce Updated\frontend\src"):
    for file in files:
        if file.endswith(('.tsx', '.ts')):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = content
            for k, v in replacements.items():
                new_content = new_content.replace(k, v)
                
            if new_content != content:
                print(f"Updated {path}")
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
