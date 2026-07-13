import os

target = os.path.join("frontend", "src", "components", "hrms", "EmployeeManagement.tsx")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

old_import = 'import { Plus, Search, Filter, Mail, Phone, MapPin, Users, Briefcase, Target, Edit2, Trash2, Loader2, Star, Upload, FileText, CheckCircle, AlertTriangle, ArrowRight, ShieldAlert, Key, Clipboard, Check } from "lucide-react";'
new_import = 'import { Plus, Search, Filter, Mail, Phone, MapPin, Users, User, Briefcase, Target, Edit2, Trash2, Loader2, Star, Upload, FileText, CheckCircle, AlertTriangle, ArrowRight, ShieldAlert, Key, Clipboard, Check } from "lucide-react";'

if old_import in content:
    content = content.replace(old_import, new_import)
    with open(target, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(content)
    print("Successfully added User icon to lucide-react imports in EmployeeManagement.tsx")
else:
    print("Could not find the target import statement in EmployeeManagement.tsx")
