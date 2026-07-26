import os, re

with open('frontend/src/data/navigation.ts', 'r') as f:
    nav_content = f.read()

tabs = re.findall(r'tab=([a-zA-Z_]+)', nav_content)
print(f'Found {len(set(tabs))} unique tabs in navigation.ts')

unused_tabs = []
for tab in set(tabs):
    found = False
    for root, _, files in os.walk('frontend/src/routes'):
        for file in files:
            if file.endswith('.tsx'):
                with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                    content = f.read()
                    if f'"{tab}"' in content or f"'{tab}'" in content or f'value="{tab}"' in content or f"value='{tab}'" in content:
                        found = True
                        break
        if found: break
    if not found:
        unused_tabs.append(tab)

print('Unused Tabs:', unused_tabs)

# Check backend models
print("\nScanning Backend for Unused Models...")
models = set()
for root, _, files in os.walk('backend/src/models'):
    for file in files:
        if file.endswith('.py') and file != '__init__.py':
            with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                content = f.read()
                class_matches = re.findall(r'class\s+([A-Z][a-zA-Z0-9]+)\(', content)
                models.update(class_matches)

used_models = set()
for root, _, files in os.walk('backend/src/api'):
    for file in files:
        if file.endswith('.py'):
            with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                content = f.read()
                for model in models:
                    if model in content:
                        used_models.add(model)

print("Potentially Unused Models in Backend API Routes:")
for m in models - used_models:
    print(f"  {m}")
