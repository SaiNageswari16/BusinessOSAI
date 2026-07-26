import re

with open('src/data/navigation.ts', 'r') as f:
    content = f.read()

# Extract all imports from lucide-react
import_match = re.search(r'import\s+\{([^}]+)\}\s+from\s+"lucide-react";', content, flags=re.DOTALL)
if import_match:
    imports_str = import_match.group(1)
    
    # Split, strip, and get unique imports
    import_list = [i.strip() for i in imports_str.replace('\n', ',').split(',') if i.strip()]
    
    # Remove 'Storefront' since it doesn't exist, and remove duplicates
    unique_imports = set(import_list)
    if 'Storefront' in unique_imports:
        unique_imports.remove('Storefront')
        
    # Replace Storefront with Store in the file content if it was used anywhere else
    content = content.replace('icon: Storefront', 'icon: Store')
    
    # Generate new import string
    sorted_imports = sorted(list(unique_imports))
    
    # Group them 10 per line for readability
    lines = []
    for i in range(0, len(sorted_imports), 10):
        lines.append("  " + ", ".join(sorted_imports[i:i+10]))
        
    new_import_block = "import {\n" + ",\n".join(lines) + "\n} from \"lucide-react\";"
    
    # Replace the old import block with the new one
    content = content[:import_match.start()] + new_import_block + content[import_match.end():]
    
    with open('src/data/navigation.ts', 'w') as f:
        f.write(content)
        
    print("Imports cleaned successfully.")
else:
    print("Could not find import block.")
