import os
import re

# Find unused tabs in frontend
with open('frontend/src/data/navigation.ts', 'r') as f:
    nav_content = f.read()

# Extract all 'to' paths
nav_paths = re.findall(r'to:\s*"([^"]+)"', nav_content)

# Extract just the base route and the tab parameter (if any)
routes = set()
for path in nav_paths:
    if '?' in path:
        route, query = path.split('?')
        tab_match = re.search(r'tab=([^&]+)', query)
        if tab_match:
            routes.add((route, tab_match.group(1)))
    else:
        routes.add((path, None))

# Now scan src/routes
actual_routes = {}
for root, _, files in os.walk('frontend/src/routes'):
    for file in files:
        if file.endswith('.tsx'):
            route_name = file.replace('.tsx', '').replace('_app', '').replace('.', '/')
            if route_name == '/index': route_name = '/'
            if not route_name.startswith('/'): route_name = '/' + route_name
            actual_routes[route_name] = file

unused_tabs = []
for route, tab in routes:
    if route not in actual_routes and route.replace('/_app', '') not in actual_routes:
        # Check if it matches dynamic routes like /pos, etc.
        route_clean = route
        if route_clean == '/dashboard': route_clean = '/_app/dashboard'
        
        # We will do a fuzzy match for routes.
        found = False
        for r in actual_routes:
            if r.replace('_app/', '') == route.lstrip('/'):
                found = True
                break
        
        if not found:
            unused_tabs.append((route, tab))

print("Unused Tabs/Routes defined in navigation.ts:")
for r, t in unused_tabs:
    print(f"  Route: {r} | Tab: {t}")

print("\nScanning Backend for Unused Models...")
# Find all models
models = set()
for root, _, files in os.walk('backend/src/models'):
    for file in files:
        if file.endswith('.py') and file != '__init__.py':
            with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                content = f.read()
                class_matches = re.findall(r'class\s+([A-Z][a-zA-Z0-9]+)\(', content)
                models.update(class_matches)

# Scan API for model usage
used_models = set()
for root, _, files in os.walk('backend/src/api'):
    for file in files:
        if file.endswith('.py'):
            with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                content = f.read()
                for model in models:
                    if model in content:
                        used_models.add(model)

print("Potentially Unused Models in Backend:")
for m in models - used_models:
    print(f"  {m}")

