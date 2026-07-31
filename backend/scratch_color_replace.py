import os

files_to_process = [
    r"c:\Users\Admin\Desktop\E-Commerce Updated\frontend\src\components\storefront\VegistHeader.tsx",
    r"c:\Users\Admin\Desktop\E-Commerce Updated\frontend\src\components\storefront\VegistNavBar.tsx",
    r"c:\Users\Admin\Desktop\E-Commerce Updated\frontend\src\routes\store.tsx",
    r"c:\Users\Admin\Desktop\E-Commerce Updated\frontend\src\routes\store.index.tsx",
    r"c:\Users\Admin\Desktop\E-Commerce Updated\frontend\src\routes\store.wallet.tsx",
    r"c:\Users\Admin\Desktop\E-Commerce Updated\frontend\src\routes\store.wishlist.tsx"
]

for filepath in files_to_process:
    if not os.path.exists(filepath):
        continue
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Colors
        content = content.replace("bg-blue-600", "bg-purple-900")
        content = content.replace("text-blue-600", "text-purple-900")
        content = content.replace("border-blue-600", "border-purple-900")
        
        content = content.replace("hover:text-blue-600", "hover:text-amber-600")
        content = content.replace("hover:bg-blue-600", "hover:bg-amber-600")
        content = content.replace("hover:border-blue-600", "hover:border-amber-600")
        
        content = content.replace("bg-blue-700", "bg-amber-600")
        content = content.replace("hover:bg-blue-700", "hover:bg-amber-600")
        
        content = content.replace("bg-[#FF4E50]", "bg-amber-500")
        
        # Name
        content = content.replace("VEGIST", "LAZYMONKEYAI")
        content = content.replace("VEG<span className=\"text-blue-600\">IST</span>", "LAZYMONKEYAI")
        content = content.replace("Vegist", "LazyMonkeyAI")
        content = content.replace("BUSINESSOSAI", "LazyMonkeyAI")
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated: {filepath}")
    except Exception as e:
        print(f"Failed {filepath}: {e}")
