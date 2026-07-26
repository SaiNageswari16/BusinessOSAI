import re

with open('src/data/navigation.ts', 'r') as f:
    content = f.read()

imports_to_add = ['GitBranch', 'Waypoints', 'Database', 'RefreshCcw', 'Megaphone', 'Headset', 'MessageSquare', 'Ticket', 'BookOpen', 'ArrowDownToLine', 'ArrowUpFromLine', 'Receipt', 'FileText', 'CalendarRange', 'BriefcaseBusiness', 'GraduationCap', 'UserCircle2', 'DoorOpen']

content = re.sub(r'(from "lucide-react";)', ', '.join(imports_to_add) + r'\n\1', content)

replacements = {
    'label: "Organization",\n        icon: Building2': 'label: "Organization",\n        icon: Network',
    'label: "Financial Configuration",\n        icon: CreditCard': 'label: "Financial Configuration",\n        icon: Landmark',
    'label: "Access & Security",\n        icon: ShieldCheck': 'label: "Access & Security",\n        icon: ShieldCheck',
    'label: "Workflow Engine",\n        icon: Network': 'label: "Workflow Engine",\n        icon: Waypoints',
    'label: "Master Data",\n        icon: MapPin': 'label: "Master Data",\n        icon: Database',
    
    'label: "Product Master",\n        icon: Boxes': 'label: "Product Master",\n        icon: Archive',
    'label: "Inventory Operations",\n        icon: Activity': 'label: "Inventory Operations",\n        icon: Activity',
    'label: "Warehouse Management",\n        icon: Warehouse': 'label: "Warehouse Management",\n        icon: Warehouse',
    'label: "Batch & Traceability",\n        icon: Hash': 'label: "Batch & Traceability",\n        icon: ScanLine',
    'label: "Inventory Intelligence",\n        icon: BrainCircuit': 'label: "Inventory Intelligence",\n        icon: AreaChart',
    
    'label: "Supplier Management",\n        icon: Truck': 'label: "Supplier Management",\n        icon: UserCheck',
    'label: "Procurement",\n        icon: ShoppingBag': 'label: "Procurement",\n        icon: ShoppingCart',
    'label: "Vendor Payments",\n        icon: CreditCard': 'label: "Vendor Payments",\n        icon: Banknote',
    'label: "Procurement Intelligence",\n        icon: BrainCircuit': 'label: "Procurement Intelligence",\n        icon: AreaChart',
    
    'label: "Terminal",\n        icon: ShoppingCart': 'label: "Terminal",\n        icon: ScanLine',
    'label: "Store Operations",\n        icon: Store': 'label: "Store Operations",\n        icon: Store',
    'label: "Returns & Exchange",\n        icon: ArrowRightLeft': 'label: "Returns & Exchange",\n        icon: RefreshCcw',
    
    'label: "Customer Management",\n        icon: Users': 'label: "Customer Management",\n        icon: UserCheck',
    'label: "Marketing & Sales",\n        icon: TrendingUp': 'label: "Marketing & Sales",\n        icon: Megaphone',
    'label: "Customer Service",\n        icon: Activity': 'label: "Customer Service",\n        icon: Headset',
    'label: "Communication",\n        icon: Radio': 'label: "Communication",\n        icon: MessageSquare',
    'label: "Customer Intelligence",\n        icon: BrainCircuit': 'label: "Customer Intelligence",\n        icon: AreaChart',
    
    'label: "Vendor Management",\n        icon: Store': 'label: "Vendor Management",\n        icon: Store',
    'label: "Marketplace Products",\n        icon: Package': 'label: "Marketplace Products",\n        icon: Archive',
    'label: "Orders",\n        icon: ShoppingCart': 'label: "Orders",\n        icon: ShoppingCart',
    'label: "Delivery",\n        icon: Truck': 'label: "Delivery",\n        icon: Truck',
    'label: "Promotions",\n        icon: Tags': 'label: "Promotions",\n        icon: Ticket',
    'label: "Marketplace Intelligence",\n        icon: BrainCircuit': 'label: "Marketplace Intelligence",\n        icon: AreaChart',
    
    'label: "Accounting",\n        icon: Calculator': 'label: "Accounting",\n        icon: BookOpen',
    'label: "Receivables",\n        icon: CreditCard': 'label: "Receivables",\n        icon: ArrowDownToLine',
    'label: "Payables",\n        icon: CreditCard': 'label: "Payables",\n        icon: ArrowUpFromLine',
    'label: "Banking",\n        icon: Building2': 'label: "Banking",\n        icon: Landmark',
    'label: "Taxes",\n        icon: Calculator': 'label: "Taxes",\n        icon: Receipt',
    'label: "Assets",\n        icon: Boxes': 'label: "Assets",\n        icon: Archive',
    'label: "Budgeting",\n        icon: LineChart': 'label: "Budgeting",\n        icon: PieChart',
    'label: "Expenses",\n        icon: CreditCard': 'label: "Expenses",\n        icon: Banknote',
    'label: "Financial Statements",\n        icon: FileCheck': 'label: "Financial Statements",\n        icon: FileText',
    'label: "Financial Intelligence",\n        icon: BrainCircuit': 'label: "Financial Intelligence",\n        icon: AreaChart',
    
    'label: "Employee Management",\n        icon: Users': 'label: "Employee Management",\n        icon: UserCheck',
    'label: "Attendance",\n        icon: Clock': 'label: "Attendance",\n        icon: Clock',
    'label: "Leave",\n        icon: Calendar': 'label: "Leave",\n        icon: CalendarRange',
    'label: "Payroll",\n        icon: CreditCard': 'label: "Payroll",\n        icon: Banknote',
    'label: "Recruitment",\n        icon: Briefcase': 'label: "Recruitment",\n        icon: BriefcaseBusiness',
    'label: "Performance",\n        icon: Target': 'label: "Performance",\n        icon: Target',
    'label: "Learning",\n        icon: BrainCircuit': 'label: "Learning",\n        icon: GraduationCap',
    'label: "Employee Self Service",\n        icon: UserCog': 'label: "Employee Self Service",\n        icon: UserCircle2',
    'label: "Exit Management",\n        icon: ArrowRightLeft': 'label: "Exit Management",\n        icon: DoorOpen',
    'label: "HR Intelligence",\n        icon: BrainCircuit': 'label: "HR Intelligence",\n        icon: AreaChart',
    
    'label: "Devices",\n        icon: Radio': 'label: "Devices",\n        icon: RadioTower',
    'label: "Monitoring",\n        icon: Activity': 'label: "Monitoring",\n        icon: Activity',
    'label: "Smart Infrastructure",\n        icon: Building2': 'label: "Smart Infrastructure",\n        icon: Factory',
    'label: "Tracking",\n        icon: MapPin': 'label: "Tracking",\n        icon: MapPin',
    'label: "IoT Analytics",\n        icon: BrainCircuit': 'label: "IoT Analytics",\n        icon: AreaChart',
}

for k, v in replacements.items():
    content = content.replace(k, v)

with open('src/data/navigation.ts', 'w') as f:
    f.write(content)

print("Replaced icons successfully.")
