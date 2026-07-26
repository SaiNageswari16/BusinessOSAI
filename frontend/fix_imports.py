import re

with open('src/data/navigation.ts', 'r') as f:
    content = f.read()

# Fix the broken import block
broken_import_regex = r"\} GitBranch.*?from \"lucide-react\";"
replacement = "  GitBranch, Waypoints, RefreshCcw, Megaphone, Headset, MessageSquare, Ticket, BookOpen, Receipt, FileText, CalendarRange, BriefcaseBusiness, GraduationCap, UserCircle2, DoorOpen\n} from \"lucide-react\";"

content = re.sub(broken_import_regex, replacement, content, flags=re.DOTALL)

with open('src/data/navigation.ts', 'w') as f:
    f.write(content)
