import os

search_paths = [
    r"c:\Users\Admin\Desktop\E-Commerce Updated\frontend\src",
    r"c:\Users\Admin\Desktop\E-Commerce Updated\backend\src",
    r"c:\Users\Admin\Desktop\E-Commerce Updated\frontend\public"
]

files_updated = 0

for base_path in search_paths:
    for root, dirs, files in os.walk(base_path):
        for file in files:
            if not file.endswith(('.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.py', '.html')):
                continue
                
            filepath = os.path.join(root, file)
            
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                original_content = content
                
                # Replace Retail
                content = content.replace("LazyMonkeyAI Retail", "LazyMonkeyAI")
                content = content.replace("lazymonkeyai retail", "lazymonkeyai")
                content = content.replace("LazyMonkeyAI retail", "LazyMonkeyAI")
                
                # Replace taglines
                content = content.replace("Enterprise Operating System", "Smart AI for Lazy Geniuses")
                content = content.replace("ENTERPRISE OPERATING SYSTEM", "SMART AI FOR LAZY GENIUSES")
                
                # Replace "AI Edition" in the topbar
                content = content.replace("AI Edition", "Smart AI for Lazy Geniuses")
                
                if content != original_content:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(content)
                    files_updated += 1
                    print(f"Updated: {filepath}")
            except Exception as e:
                print(f"Failed {filepath}: {e}")

print(f"Done. Updated {files_updated} files.")
