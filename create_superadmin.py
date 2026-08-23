#!/usr/bin/env python3
"""
Create Platform Super Admin CLI Launcher
----------------------------------------
Run this script to create or upgrade a platform Super Admin user.

Usage:
  python create_superadmin.py
  python create_superadmin.py --email admin@businessos.com --password mysecretpassword --name "Super Admin"
"""
import os
import subprocess
import sys

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(root_dir, "backend")
    target_script = os.path.join(backend_dir, "create_superadmin.py")

    if not os.path.isfile(target_script):
        print(f"Error: Could not locate backend script at {target_script}", file=sys.stderr)
        sys.exit(1)

    cmd = [sys.executable, target_script] + sys.argv[1:]
    
    # Run the script with the backend directory as working directory
    try:
        proc = subprocess.run(cmd, cwd=backend_dir)
        sys.exit(proc.returncode)
    except KeyboardInterrupt:
        print("\nAborted.")
        sys.exit(130)

if __name__ == "__main__":
    main()
