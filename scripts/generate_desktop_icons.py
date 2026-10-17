import os
import subprocess
import shutil
from PIL import Image

def generate_icons():
    base_dir = "/Users/yashwanth/Downloads/gym_web/gym_web/backend_repo"
    logo_path = os.path.join(base_dir, "frontend", "public", "Logo.png")
    desktop_assets = os.path.join(base_dir, "desktop", "assets")
    downloads_dir = os.path.join(base_dir, "frontend", "public", "downloads")
    public_dir = os.path.join(base_dir, "frontend", "public")

    os.makedirs(desktop_assets, exist_ok=True)
    os.makedirs(downloads_dir, exist_ok=True)

    print(f"Loading master logo from: {logo_path}")
    img = Image.open(logo_path).convert("RGBA")
    
    # 1. Master icon.png
    master_icon_path = os.path.join(desktop_assets, "icon.png")
    img.save(master_icon_path, "PNG")
    shutil.copyfile(master_icon_path, os.path.join(downloads_dir, "BusinessOS-AI-Logo.png"))
    print("Saved master icon.png")

    # 2. Windows icon.ico (16, 24, 32, 48, 64, 128, 256)
    ico_path = os.path.join(desktop_assets, "icon.ico")
    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    img.save(ico_path, format="ICO", sizes=ico_sizes)
    shutil.copyfile(ico_path, os.path.join(downloads_dir, "BusinessOS-AI-Windows.ico"))
    shutil.copyfile(ico_path, os.path.join(public_dir, "favicon.ico"))
    print(f"Generated Windows icon.ico with sizes: {ico_sizes}")

    # 3. macOS icon.icns via iconutil
    iconset_dir = os.path.join(desktop_assets, "icon.iconset")
    os.makedirs(iconset_dir, exist_ok=True)
    
    mac_sizes = [
        ("icon_16x16.png", (16, 16)),
        ("icon_16x16@2x.png", (32, 32)),
        ("icon_32x32.png", (32, 32)),
        ("icon_32x32@2x.png", (64, 64)),
        ("icon_128x128.png", (128, 128)),
        ("icon_128x128@2x.png", (256, 256)),
        ("icon_256x256.png", (256, 256)),
        ("icon_256x256@2x.png", (512, 512)),
        ("icon_512x512.png", (512, 512)),
        ("icon_512x512@2x.png", (1024, 1024)),
    ]

    for name, size in mac_sizes:
        resized = img.resize(size, Image.Resampling.LANCZOS)
        resized.save(os.path.join(iconset_dir, name), "PNG")

    icns_path = os.path.join(desktop_assets, "icon.icns")
    res = subprocess.run(["iconutil", "-c", "icns", iconset_dir, "-o", icns_path], capture_output=True, text=True)
    if res.returncode == 0:
        shutil.copyfile(icns_path, os.path.join(downloads_dir, "BusinessOS-AI-Apple.icns"))
        print("Generated Apple macOS icon.icns successfully!")
    else:
        print(f"iconutil warning: {res.stderr}")

    # Clean up temporary iconset directory
    shutil.rmtree(iconset_dir, ignore_errors=True)

    # 4. iOS Apple Touch Icons (180x180, 192x192, 512x512)
    ios_180 = img.resize((180, 180), Image.Resampling.LANCZOS)
    ios_180.save(os.path.join(desktop_assets, "apple-touch-icon.png"), "PNG")
    ios_180.save(os.path.join(public_dir, "apple-touch-icon.png"), "PNG")
    ios_180.save(os.path.join(downloads_dir, "BusinessOS-AI-iOS.png"), "PNG")

    ios_192 = img.resize((192, 192), Image.Resampling.LANCZOS)
    ios_192.save(os.path.join(public_dir, "icon-192.png"), "PNG")

    ios_512 = img.resize((512, 512), Image.Resampling.LANCZOS)
    ios_512.save(os.path.join(public_dir, "icon-512.png"), "PNG")

    print("Generated iOS touch icons: apple-touch-icon.png, icon-192.png, icon-512.png")
    print("All icons successfully generated in desktop/assets and public/downloads!")

if __name__ == "__main__":
    generate_icons()
