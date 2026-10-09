import {
  Activity, AlertTriangle, Archive, AreaChart, ArrowDownToLine, ArrowRightLeft, ArrowUpRight, Award, Banknote, BarChart3, Barcode, BellRing, Blocks,
  BookOpen, Boxes, BrainCircuit, Briefcase, BriefcaseBusiness, Building, Building2, Calculator, Calendar, CalendarClock,
  CalendarRange, CalendarX, ChartPie, ChartSpline, CheckCircle2, CircleDollarSign, ClipboardCheck, ClipboardList, Clock, Cog, Columns,
  Combine, Compass, Component, Contact, CreditCard, Crosshair, Database, DollarSign, DoorOpen, Factory, FileCheck,
  FileSpreadsheet, FileText, Fingerprint, FlaskConical, FolderTree, Gift, GitBranch, Goal, GraduationCap, Grid, Hash, Headset,
  Heart, HeartHandshake, History, Image, Inbox, Landmark, Laptop, Layers, LayoutDashboard, LibraryBig, LineChart,
  ListChecks, Lock, Map, MapPin, Megaphone, MessageSquare, MessagesSquare, Microscope, Monitor, Navigation,
  Network, Package, PackageOpen, PackagePlus, Palette, Percent, PieChart, Plus, Printer, QrCode, Radio, RadioTower, Receipt,
  RefreshCcw, RefreshCw, Rocket, RotateCcw, RotateCw, Scale, ScanBarcode, ScanLine, Search, Settings, Settings2,
  ShieldCheck, ShieldAlert, ShoppingBag, ShoppingBasket, ShoppingCart, Signal, Skull, Sliders, SlidersHorizontal, Snail, Sparkles,
  Store, Tag, Tags, Target, Terminal, Ticket, Timer, TrendingUp, Truck, UserCheck,
  UserCircle2, UserCog, Users, UsersRound, Wallet, Warehouse, Waypoints, Webcam, Workflow
} from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  icon: any;
  badge?: string;
  isHighlighted?: boolean;
  permission?: string;
  subItems?: { to: string; label: string; icon: any; permission?: string }[];
};

export type NavGroup = {
  group: string;
  icon: any;
  permission?: string;
  theme?: string;
  items: NavItem[];
};

export const nav: NavGroup[] = [
  {
    group: "Workspace", theme: "indigo", icon: Package, items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "view:dashboard" },
      { to: "/dashboard?tab=lazymonkey_ai", label: "IoTRONCS AI", icon: Sparkles, badge: "OS", permission: "view:dashboard" },
    ]
  },
  {
    group: "Core ERP", theme: "blue", icon: Component, permission: "view:erp", items: [
      {
        to: "/erp?tab=companies",
        label: "Organization",
        icon: Building2,
        permission: "view:erp",
        subItems: [
          { to: "/erp?tab=companies", label: "Companies", icon: Building, permission: "view:companies" },
          { to: "/erp?tab=business_units", label: "Business Units", icon: Network, permission: "view:erp" },
          { to: "/erp?tab=regions", label: "Regions", icon: MapPin, permission: "view:geography" },
          { to: "/erp?tab=zones", label: "Zones", icon: MapPin, permission: "view:geography" },
          { to: "/erp?tab=branches", label: "Branches", icon: MapPin, permission: "view:branches" },
          { to: "/erp?tab=departments", label: "Departments", icon: LibraryBig, permission: "view:departments" },
          { to: "/erp?tab=designations", label: "Designations", icon: Target, permission: "view:designations" },
          { to: "/erp?tab=teams", label: "Teams", icon: UsersRound, permission: "view:teams" },
          { to: "/erp?tab=org_structure", label: "Organization Structure", icon: Network, permission: "view:branches" },
        ]
      },
      {
        to: "/erp?tab=fiscal_years",
        label: "Financial Configuration",
        icon: CreditCard,
        permission: "view:financials",
        subItems: [
          { to: "/erp?tab=fiscal_years", label: "Fiscal Years", icon: Calendar, permission: "view:fiscal_years" },
          { to: "/erp?tab=cost_centers", label: "Cost Centers", icon: CreditCard, permission: "view:cost_centers" },
          { to: "/erp?tab=currencies", label: "Currency Management", icon: Calculator, permission: "view:currencies" },
          { to: "/erp?tab=taxes", label: "Tax Configuration", icon: Calculator, permission: "view:taxes" },
          { to: "/erp?tab=payment_terms", label: "Payment Terms", icon: CreditCard, permission: "view:payment_terms" },
          { to: "/erp?tab=payment_gateways", label: "Payment Gateways", icon: CreditCard, permission: "view:financials" },
          { to: "/erp?tab=number_series", label: "Number Series", icon: Calculator, permission: "view:number_series" },
        ]
      },
      {
        to: "/erp?tab=users",
        label: "Access & Security",
        icon: ShieldCheck,
        permission: "view:access_control",
        subItems: [
          { to: "/erp?tab=users", label: "Users", icon: Users, permission: "view:users" },
          { to: "/erp?tab=roles", label: "Roles", icon: Contact, permission: "view:roles" },
          { to: "/erp?tab=permission_matrix", label: "Permission Matrix", icon: ShieldCheck, permission: "view:permission_matrix" },
          { to: "/erp?tab=workspaces", label: "Workspaces", icon: Terminal, permission: "view:workspaces" },
          { to: "/erp?tab=subscriptions", label: "Subscription & License", icon: ShieldCheck, permission: "view:subscription" },
          { to: "/erp?tab=api_keys", label: "API Keys", icon: Network, permission: "view:api_keys" },
          { to: "/erp?tab=mfa_policies", label: "MFA Policies", icon: ShieldCheck, permission: "view:mfa_policies" },
        ]
      },
      {
        to: "/erp?tab=approval_workflows",
        label: "Workflow Engine",
        icon: Network,
        permission: "view:workflows",
        subItems: [
          { to: "/erp?tab=approval_workflows", label: "Approval Workflows", icon: Network, permission: "view:workflows" },
          { to: "/erp?tab=notification_templates", label: "Notification Templates", icon: Radio, permission: "view:notification_templates" },
          { to: "/erp?tab=document_templates", label: "Document Templates", icon: Briefcase, permission: "view:document_templates" },
          { to: "/erp?tab=custom_fields", label: "Custom Fields", icon: Target, permission: "view:settings" },
          { to: "/erp?tab=automation_rules", label: "Automation Rules", icon: Settings, permission: "view:workflows" },
        ]
      },
      {
        to: "/erp?tab=geography",
        label: "Master Data",
        icon: MapPin,
        permission: "view:erp",
        subItems: [
          { to: "/erp?tab=geography", label: "Geography (Countries/States/Cities)", icon: MapPin, permission: "view:geography" },
          { to: "/erp?tab=locations", label: "Locations", icon: MapPin, permission: "view:locations" },
          { to: "/erp?tab=calendars_shifts", label: "Calendars & Shifts", icon: Calendar, permission: "view:erp" },
          { to: "/erp?tab=tags_labels", label: "Tags & Labels", icon: Target, permission: "view:tags" },
        ]
      },
      {
        to: "/erp?tab=global_users",
        label: "System Administration",
        icon: Settings,
        permission: "manage:system_admin",
        subItems: [
          { to: "/erp?tab=global_users", label: "Global Users", icon: ShieldCheck, permission: "manage:system_admin" },
          { to: "/erp?tab=audit_logs", label: "Audit Logs", icon: History, permission: "manage:system_admin" },
          { to: "/erp?tab=activity_logs", label: "Activity Logs", icon: Activity, permission: "manage:system_admin" },
          { to: "/erp?tab=error_logs", label: "Error Logs", icon: Activity, permission: "manage:system_admin" },
          { to: "/erp?tab=system_health", label: "System Health", icon: Activity, permission: "manage:system_admin" },
          { to: "/erp?tab=backup_restore", label: "Backup & Restore", icon: History, permission: "manage:system_admin" },
          { to: "/erp?tab=global_settings", label: "Global Settings", icon: Settings, permission: "manage:system_admin" },
        ]
      }
    ]
  },
  {
    group: "Inventory & Warehouse", theme: "cyan", icon: Archive, permission: "view:inventory", items: [
      {
        to: "/inventory?tab=products",
        label: "Product Master",
        icon: Boxes,
        permission: "view:inventory",
        subItems: [
          { to: "/inventory?tab=products", label: "Products", icon: PackageOpen, permission: "view:inventory" },
          { to: "/inventory?tab=categories", label: "Categories", icon: LibraryBig, permission: "view:product_categories" },
          { to: "/inventory?tab=brands", label: "Brands", icon: Tags, permission: "view:brands" },
          { to: "/inventory?tab=units", label: "Units of Measure", icon: Scale, permission: "view:inventory" },
          { to: "/inventory?tab=attributes", label: "Product Attributes", icon: SlidersHorizontal, permission: "view:inventory" },
          { to: "/inventory?tab=variants", label: "Product Variants", icon: Combine, permission: "view:inventory" },
          { to: "/inventory?tab=bundles", label: "Product Bundles", icon: PackagePlus, permission: "view:inventory" },
          { to: "/inventory?tab=kits", label: "Product Kits", icon: Blocks, permission: "view:inventory" },
          { to: "/inventory?tab=images", label: "Product Images", icon: Image, permission: "view:inventory" },
        ]
      },
      {
        to: "/inventory?tab=stock_overview",
        label: "Inventory Operations",
        icon: Activity,
        permission: "view:inventory",
        subItems: [
          { to: "/inventory?tab=stock_overview", label: "Stock Overview", icon: BarChart3, permission: "view:inventory" },
          { to: "/inventory?tab=stock_movement", label: "Stock Movement", icon: ArrowRightLeft, permission: "view:inventory" },
          { to: "/inventory?tab=stock_adjustment", label: "Stock Adjustment", icon: Sliders, permission: "view:stock_adjustments" },
          { to: "/inventory?tab=stock_transfer", label: "Stock Transfer", icon: Truck, permission: "view:stock_transfers" },
          { to: "/inventory?tab=cycle_counting", label: "Cycle Counting", icon: RotateCw, permission: "view:inventory" },
          { to: "/inventory?tab=physical_audit", label: "Physical Stock Audit", icon: ClipboardCheck, permission: "view:inventory" },
        ]
      },
      {
        to: "/inventory?tab=warehouses",
        label: "Warehouse Management",
        icon: Warehouse,
        permission: "view:warehouse",
        subItems: [
          { to: "/inventory?tab=warehouses", label: "Warehouses", icon: Warehouse, permission: "view:warehouse" },
          { to: "/inventory?tab=storage_locations", label: "Storage Locations", icon: MapPin, permission: "view:warehouse" },
          { to: "/inventory?tab=zones", label: "Zones", icon: Grid, permission: "view:warehouse" },
          { to: "/inventory?tab=racks", label: "Racks", icon: Columns, permission: "view:warehouse" },
          { to: "/inventory?tab=bins", label: "Bins", icon: Inbox, permission: "view:warehouse" },
          { to: "/inventory?tab=put_away_rules", label: "Put Away Rules", icon: ArrowDownToLine, permission: "view:warehouse" },
          { to: "/inventory?tab=picking_rules", label: "Picking Rules", icon: ListChecks, permission: "view:warehouse" },
        ]
      },
      {
        to: "/inventory?tab=batches",
        label: "Batch & Traceability",
        icon: Hash,
        permission: "view:inventory",
        subItems: [
          { to: "/inventory?tab=batches", label: "Batch Numbers", icon: Hash, permission: "view:inventory" },
          { to: "/inventory?tab=serials", label: "Serial Numbers", icon: Barcode, permission: "view:inventory" },
          { to: "/inventory?tab=traceability", label: "Traceability", icon: FlaskConical, permission: "view:inventory" },
          { to: "/inventory?tab=expiry", label: "Expiry Management", icon: CalendarX, permission: "view:inventory" },
          { to: "/inventory?tab=mfg_dates", label: "Manufacturing Dates", icon: CalendarClock, permission: "view:inventory" },
          { to: "/inventory?tab=barcodes", label: "Barcode Management", icon: ScanBarcode, permission: "view:barcodes" },
          { to: "/inventory?tab=qrcodes", label: "QR Code Management", icon: QrCode, permission: "view:barcodes" },
          { to: "/inventory?tab=rfid", label: "RFID Management", icon: Radio, permission: "view:barcodes" },
        ]
      },
      {
        to: "/inventory?tab=low_stock",
        label: "Inventory Intelligence",
        icon: BrainCircuit,
        permission: "view:inventory",
        subItems: [
          { to: "/inventory?tab=ai_health", label: "AI Inventory Health", icon: Sparkles, permission: "view:inventory" },
          { to: "/inventory?tab=low_stock", label: "Low Stock Alerts", icon: AlertTriangle, permission: "view:inventory" },
          { to: "/inventory?tab=reorder_planning", label: "Reorder Planning", icon: TrendingUp, permission: "view:inventory" },
          { to: "/inventory?tab=slow_moving", label: "Slow Moving Inventory", icon: Snail, permission: "view:inventory" },
          { to: "/inventory?tab=fast_moving", label: "Fast Moving Inventory", icon: Rocket, permission: "view:inventory" },
          { to: "/inventory?tab=dead_stock", label: "Dead Stock", icon: Skull, permission: "view:inventory" },
          { to: "/inventory?tab=abc_analysis", label: "ABC Analysis", icon: PieChart, permission: "view:inventory" },
          { to: "/inventory?tab=xyz_analysis", label: "XYZ Analysis", icon: LineChart, permission: "view:inventory" },
          { to: "/inventory?tab=forecast", label: "Inventory Forecast", icon: BrainCircuit, permission: "view:inventory" },
        ]
      },
      {
        to: "/inventory?tab=print_templates",
        label: "Print & Document Templates",
        icon: Printer,
        permission: "view:document_templates",
      },
    ]
  },
  {
    group: "Purchase", theme: "teal", icon: ShoppingBag, permission: "view:procurement", items: [
      {
        to: "/procurement?tab=vendor_bills",
        label: "Purchase Invoice",
        icon: Receipt,
        permission: "view:procurement",
        subItems: [
          { to: "/procurement?tab=vendor_bills", label: "Purchase Invoices & Bills", icon: Receipt, permission: "view:procurement" },
          { to: "/procurement?tab=pending_payments", label: "Pending Payments", icon: Timer, permission: "view:procurement" },
          { to: "/procurement?tab=payment_history", label: "Payments Out", icon: History, permission: "view:procurement" },
          { to: "/procurement?tab=debit_notes", label: "Debit Notes", icon: FileCheck, permission: "view:procurement" },
          { to: "/procurement?tab=credit_notes", label: "Credit Notes", icon: FileCheck, permission: "view:procurement" },
          { to: "/procurement?tab=spend_analysis", label: "Spend Analysis", icon: Activity, permission: "view:procurement" },
          { to: "/procurement?tab=procurement_forecast", label: "Procurement Forecast", icon: Network, permission: "view:procurement" },
        ]
      },
      {
        to: "/procurement?tab=suppliers",
        label: "Supplier Management",
        icon: Truck,
        permission: "view:suppliers",
        subItems: [
          { to: "/procurement?tab=suppliers", label: "Suppliers & Vendors", icon: Store, permission: "view:suppliers" },
          { to: "/procurement?tab=supplier_categories", label: "Supplier Categories", icon: Layers, permission: "view:suppliers" },
          { to: "/procurement?tab=supplier_contacts", label: "Supplier Contacts", icon: Users, permission: "view:suppliers" },
          { to: "/procurement?tab=supplier_contracts", label: "Supplier Contracts", icon: Briefcase, permission: "view:suppliers" },
          { to: "/procurement?tab=supplier_performance", label: "Supplier Performance", icon: Activity, permission: "view:suppliers" },
          { to: "/procurement?tab=blacklisted_suppliers", label: "Blacklisted Suppliers", icon: ShieldCheck, permission: "view:suppliers" },
        ]
      },
      {
        to: "/procurement?tab=purchase_requests",
        label: "Purchase Requisitions (PR)",
        icon: Package,
        permission: "view:procurement",
        subItems: [
          { to: "/procurement?tab=purchase_requests", label: "Raise PR (Requisition)", icon: Package, permission: "view:procurement" },
          { to: "/procurement?tab=purchase_approvals", label: "PR Approval (Manager)", icon: ShieldCheck, permission: "view:procurement" },
          { to: "/procurement?tab=purchase_quotations", label: "Proforma / Quotations (RFQ)", icon: Network, permission: "view:rfq" },
          { to: "/procurement?tab=purchase_orders", label: "Purchase Orders (PO)", icon: Truck, permission: "view:purchase_orders" },
          { to: "/procurement?tab=goods_received_notes", label: "Goods Received Notes (GRN)", icon: Boxes, permission: "view:grn" },
          { to: "/procurement?tab=purchase_returns", label: "Purchase Returns", icon: ArrowRightLeft, permission: "view:procurement" },
        ]
      }
    ]
  },
  {
    group: "Sales", theme: "violet", icon: ScanLine, permission: "view:pos", items: [
      { to: "/pos?tab=sales_history", label: "Invoices History", icon: History, permission: "view:pos_history" },
      { to: "/pos?tab=customers", label: "Customers", icon: Users, permission: "view:crm_customers" },
      { to: "/pos?tab=quotations", label: "Quotations", icon: FileCheck, permission: "view:crm_quotations" },
      { to: "/pos?tab=credit_notes", label: "Credit Notes", icon: FileCheck, permission: "view:invoices" },
      { to: "/pos?tab=debit_notes", label: "Debit Notes", icon: FileText, permission: "view:invoices" },
      { to: "/pos?tab=proforma", label: "Proforma Invoices", icon: FileText, permission: "view:invoices" },
      { to: "/pos?tab=payment_in", label: "Payment In", icon: Wallet, permission: "view:invoices" },
      {
        to: "/pos?tab=terminal",
        label: "Terminal",
        icon: ShoppingCart,
        permission: "manage:pos_terminal",
        subItems: [
          { to: "/pos?tab=terminal", label: "Billing", icon: ShoppingCart, permission: "manage:pos_terminal" },
          { to: "/pos?tab=terminal&view=barcode", label: "Barcode Scanner", icon: ScanBarcode, permission: "manage:pos_terminal" },
          { to: "/pos?tab=terminal&view=delivery", label: "Delivery", icon: Truck, permission: "manage:pos_terminal" },
          { to: "/pos?tab=terminal&view=exchange", label: "Exchange", icon: RefreshCw, permission: "manage:pos_terminal" },
          { to: "/pos?tab=terminal&view=refund", label: "Refund", icon: CreditCard, permission: "refund:pos_history" },
          { to: "/pos?tab=terminal&view=price_check", label: "Price Check", icon: Tag, permission: "manage:pos_terminal" },
          { to: "/pos?tab=terminal&view=favorites", label: "Favorites", icon: Heart, permission: "manage:pos_terminal" },
          { to: "/pos?tab=terminal&view=recent", label: "Recent Bills", icon: History, permission: "manage:pos_terminal" },
          { to: "/pos?tab=terminal&view=ai_suggest", label: "AI Suggestions", icon: Sparkles, permission: "manage:pos_terminal" },
          { to: "/pos?tab=store_operations", label: "Store Operations", icon: Store, permission: "view:pos_register" },
          { to: "/pos?tab=returns", label: "Return / Exchange", icon: ArrowRightLeft, permission: "refund:pos_history" },
        ]
      },
      { to: "/pos?tab=goods_receipt", label: "Goods Receipt (GRN)", icon: ClipboardList, permission: "view:grn" },
      { to: "/pos?tab=goods_issue", label: "Goods Issue", icon: Truck, permission: "view:dispatch" },
      { to: "/pos?tab=delivery_challans", label: "Delivery Challans", icon: FileCheck, permission: "view:dispatch" },
      {
        to: "/pos?tab=expense_claims",
        label: "Expenses",
        icon: CreditCard,
        isHighlighted: true,
        permission: "view:expense_claims",
        subItems: [
          { to: "/pos?tab=expense_claims", label: "Expense Claims", icon: CreditCard, permission: "view:expense_claims" },
          { to: "/pos?tab=approvals", label: "Approvals", icon: ShieldCheck, permission: "approve:expense_claims" },
          { to: "/pos?tab=travel", label: "Travel", icon: MapPin, permission: "view:expense_claims" },
          { to: "/pos?tab=office_expenses", label: "Office Expenses", icon: Building2, permission: "view:expense_claims" },
          { to: "/pos?tab=operational_expenses", label: "Operational Expenses", icon: Activity, permission: "view:expense_claims" },
        ]
      },
    ]
  },
  {
    group: "CRM", theme: "orange", icon: Megaphone, permission: "view:crm", items: [
      {
        to: "/crm?tab=customers",
        label: "Customer Management",
        icon: Users,
        permission: "view:crm_customers",
        subItems: [
          { to: "/crm?tab=customers", label: "Customers", icon: UsersRound, permission: "view:crm_customers" },
          { to: "/crm?tab=customer_groups", label: "Customer Groups", icon: Network, permission: "view:crm_groups" },
          { to: "/crm?tab=customer_segments", label: "Customer Segments", icon: Target, permission: "view:crm_segments" },
          { to: "/crm?tab=membership_plans", label: "Membership Plans", icon: ShieldCheck, permission: "view:crm_memberships" },
          { to: "/crm?tab=customer_wallet", label: "Customer Wallet", icon: CreditCard, permission: "view:crm_wallet" },
          { to: "/crm?tab=loyalty_program", label: "Loyalty Program", icon: Tags, permission: "view:crm_loyalty" },
          { to: "/crm?tab=customer_documents", label: "Customer Documents", icon: Briefcase, permission: "view:crm_customers" },
        ]
      },
      {
        to: "/crm?tab=ad_generator",
        label: "Marketing & Sales",
        icon: TrendingUp,
        permission: "view:crm",
        subItems: [
          { to: "/crm?tab=ad_generator", label: "Marketing Ad Generator", icon: Sparkles, permission: "view:crm_campaigns" },
          { to: "/crm?tab=social_media_dashboard", label: "Social Media Dashboard", icon: BarChart3, permission: "view:crm_campaigns" },
          { to: "/crm?tab=ad_history", label: "Ad Post History", icon: History, permission: "view:crm_campaigns" },
          { to: "/crm?tab=leads", label: "Leads", icon: Crosshair, permission: "view:crm_leads" },
          { to: "/crm?tab=opportunities", label: "Opportunities", icon: Goal, permission: "view:crm" },
          { to: "/crm?tab=deals", label: "Deals", icon: Target, permission: "view:crm" },
          { to: "/crm?tab=sales_pipeline", label: "Sales Pipeline", icon: BarChart3, permission: "view:crm" },
          { to: "/crm?tab=quotations", label: "Quotations", icon: FileCheck, permission: "view:crm_quotations" },
          { to: "/crm?tab=sales_orders", label: "Sales Orders", icon: ShoppingCart, permission: "view:crm_sales_orders" },
          { to: "/crm?tab=discounts", label: "Discounts", icon: Percent, permission: "view:crm_discounts" },
        ]
      },
      {
        to: "/crm?tab=support_tickets",
        label: "Customer Service",
        icon: Activity,
        permission: "view:crm_support",
        subItems: [
          { to: "/crm?tab=support_tickets", label: "Support Tickets", icon: AlertTriangle, permission: "view:crm_support" },
          { to: "/crm?tab=complaints", label: "Complaints", icon: Activity, permission: "view:crm_support" },
          { to: "/crm?tab=returns", label: "Returns", icon: ArrowRightLeft, permission: "view:crm_support" },
          { to: "/crm?tab=feedback", label: "Feedback", icon: Sparkles, permission: "view:crm_support" },
          { to: "/crm?tab=customer_timeline", label: "Customer Timeline", icon: History, permission: "view:crm_support" },
        ]
      },
      {
        to: "/crm?tab=ai_call_logs",
        label: "Communication",
        icon: Radio,
        permission: "view:crm",
        subItems: [
          { to: "/crm?tab=ai_call_logs", label: "AI Voice Calling & Logs", icon: Headset, permission: "view:crm" },
          { to: "/crm?tab=email_campaigns", label: "Email Campaigns", icon: Inbox, permission: "view:crm_campaigns" },
          { to: "/crm?tab=sms_campaigns", label: "SMS Campaigns", icon: Radio, permission: "view:crm_campaigns" },
          { to: "/crm?tab=whatsapp_campaigns", label: "WhatsApp Campaigns", icon: Network, permission: "view:crm_campaigns" },
          { to: "/crm?tab=push_notifications", label: "Push Notifications", icon: Radio, permission: "view:crm_campaigns" },
        ]
      },
      {
        to: "/crm?tab=customer_analytics",
        label: "Customer Intelligence",
        icon: BrainCircuit,
        permission: "view:analytics",
        subItems: [
          { to: "/crm?tab=customer_analytics", label: "Customer Analytics", icon: PieChart, permission: "view:analytics" },
          { to: "/crm?tab=purchase_behaviour", label: "Purchase Behaviour", icon: Activity, permission: "view:analytics" },
          { to: "/crm?tab=churn_prediction", label: "Churn Prediction", icon: Skull, permission: "view:analytics" },
          { to: "/crm?tab=lifetime_value", label: "Lifetime Value", icon: LineChart, permission: "view:analytics" },
          { to: "/crm?tab=rfm_analysis", label: "RFM Analysis", icon: Grid, permission: "view:analytics" },
          { to: "/crm?tab=ai_recommendations", label: "AI Recommendations", icon: Sparkles, permission: "view:analytics" },
        ]
      },
    ]
  },
  {
    group: "Marketplace", theme: "sky", icon: Store, permission: "view:marketplace", items: [
      {
        to: "/marketplace?tab=vendors",
        label: "Vendor Management",
        icon: Store,
        permission: "view:marketplace_vendors",
        subItems: [
          { to: "/marketplace?tab=vendors", label: "Vendors", icon: Store, permission: "view:marketplace_vendors" },
          { to: "/marketplace?tab=vendor_categories", label: "Vendor Categories", icon: FolderTree, permission: "view:marketplace_vendors" },
          { to: "/marketplace?tab=vendor_contracts", label: "Vendor Contracts", icon: FileCheck, permission: "view:marketplace_vendors" },
          { to: "/marketplace?tab=vendor_wallet", label: "Vendor Wallet & Payouts", icon: CreditCard, permission: "view:marketplace_vendors" },
          { to: "/marketplace?tab=vendor_kyc", label: "Vendor KYC & Approvals", icon: ShieldCheck, permission: "view:marketplace_vendors" },
          { to: "/marketplace?tab=vendor_performance", label: "Vendor Performance & Ratings", icon: Activity, permission: "view:marketplace_vendors" },
        ]
      },
      {
        to: "/marketplace?tab=marketplace_products",
        label: "Marketplace Products",
        icon: Package,
        permission: "view:marketplace_catalog",
        subItems: [
          { to: "/marketplace?tab=marketplace_products", label: "Marketplace Products", icon: Package, permission: "view:marketplace_catalog" },
          { to: "/marketplace?tab=marketplace_categories", label: "Marketplace Categories", icon: FolderTree, permission: "view:marketplace_catalog" },
          { to: "/marketplace?tab=marketplace_services", label: "Marketplace Services", icon: Briefcase, permission: "view:marketplace_catalog" },
          { to: "/marketplace?tab=product_approval", label: "Product Approval", icon: ShieldCheck, permission: "view:marketplace_catalog" },
          { to: "/marketplace?tab=pricing_rules", label: "Pricing Rules", icon: Calculator, permission: "view:marketplace_catalog" },
          { to: "/marketplace?tab=bundles", label: "Bundles", icon: PackagePlus, permission: "view:marketplace_catalog" },
          { to: "/marketplace?tab=featured_products", label: "Featured Products", icon: Sparkles, permission: "view:marketplace_catalog" },
        ]
      },
      {
        to: "/marketplace?tab=orders",
        label: "Orders",
        icon: ShoppingCart,
        permission: "view:marketplace_orders",
        subItems: [
          { to: "/marketplace?tab=orders", label: "Orders", icon: ShoppingCart, permission: "view:marketplace_orders" },
          { to: "/marketplace?tab=returns", label: "Returns", icon: ArrowRightLeft, permission: "view:marketplace_orders" },
          { to: "/marketplace?tab=refunds", label: "Refunds", icon: CreditCard, permission: "view:marketplace_orders" },
          { to: "/marketplace?tab=cancellations", label: "Cancellations", icon: AlertTriangle, permission: "view:marketplace_orders" },
          { to: "/marketplace?tab=order_timeline", label: "Order Timeline", icon: History, permission: "view:marketplace_orders" },
          { to: "/marketplace?tab=invoices", label: "Invoices", icon: ClipboardList, permission: "view:marketplace_orders" },
          { to: "/marketplace?tab=order_tracking", label: "Order Tracking", icon: MapPin, permission: "view:marketplace_orders" },
        ]
      },
      {
        to: "/marketplace?tab=delivery_partners",
        label: "Delivery",
        icon: Truck,
        permission: "view:marketplace",
        subItems: [
          { to: "/marketplace?tab=delivery_partners", label: "Delivery Partners", icon: Truck, permission: "view:marketplace" },
          { to: "/marketplace?tab=drivers", label: "Drivers", icon: Users, permission: "view:marketplace" },
          { to: "/marketplace?tab=delivery_assignment", label: "Delivery Assignment", icon: Network, permission: "view:marketplace" },
          { to: "/marketplace?tab=delivery_tracking", label: "Delivery Tracking", icon: MapPin, permission: "view:marketplace" },
          { to: "/marketplace?tab=hyperlocal_delivery", label: "Hyperlocal Delivery", icon: MapPin, permission: "view:marketplace" },
          { to: "/marketplace?tab=shipping_rules", label: "Shipping Rules", icon: Sliders, permission: "view:marketplace" },
          { to: "/marketplace?tab=route_planning", label: "Route Planning", icon: MapPin, permission: "view:marketplace" },
        ]
      },
      {
        to: "/marketplace?tab=coupons",
        label: "Promotions",
        icon: Tags,
        permission: "view:marketplace",
        subItems: [
          { to: "/marketplace?tab=coupons", label: "Coupons", icon: Tags, permission: "view:marketplace" },
          { to: "/marketplace?tab=offers", label: "Offers", icon: Target, permission: "view:marketplace" },
          { to: "/marketplace?tab=campaigns", label: "Campaigns", icon: Radio, permission: "view:marketplace" },
          { to: "/marketplace?tab=flash_sales", label: "Flash Sales", icon: Sparkles, permission: "view:marketplace" },
          { to: "/marketplace?tab=wallet", label: "Wallet", icon: Wallet, permission: "view:marketplace" },
          { to: "/marketplace?tab=loyalty", label: "Loyalty", icon: Users, permission: "view:marketplace" },
          { to: "/marketplace?tab=gift_cards", label: "Gift Cards", icon: CreditCard, permission: "view:marketplace" },
        ]
      },
      {
        to: "/marketplace?tab=demand_forecast",
        label: "Marketplace Intelligence",
        icon: BrainCircuit,
        permission: "view:analytics",
        subItems: [
          { to: "/marketplace?tab=demand_forecast", label: "Demand Forecast", icon: TrendingUp, permission: "view:analytics" },
          { to: "/marketplace?tab=dynamic_pricing", label: "Dynamic Pricing", icon: Calculator, permission: "view:analytics" },
          { to: "/marketplace?tab=vendor_analytics", label: "Vendor Analytics", icon: LineChart, permission: "view:analytics" },
          { to: "/marketplace?tab=product_analytics", label: "Product Analytics", icon: PieChart, permission: "view:analytics" },
          { to: "/marketplace?tab=fraud_detection", label: "Fraud Detection", icon: Skull, permission: "view:analytics" },
          { to: "/marketplace?tab=ai_recommendations", label: "AI Recommendations", icon: Sparkles, permission: "view:analytics" },
        ]
      },
    ]
  },
  {
    group: "Accounting & Finance", theme: "emerald", icon: Banknote, permission: "view:accounting", items: [
      {
        to: "/accounting?tab=customers",
        label: "Receivables",
        icon: CreditCard,
        permission: "view:accounts_receivable",
        subItems: [
          { to: "/accounting?tab=customers", label: "Customers", icon: UsersRound, permission: "view:crm_customers" },
          { to: "/accounting?tab=invoices", label: "Invoices", icon: ClipboardList, permission: "view:invoices" },
          { to: "/accounting?tab=payments", label: "Payments", icon: Wallet, permission: "view:accounts_receivable" },
          { to: "/accounting?tab=outstanding", label: "Outstanding", icon: Clock, permission: "view:accounts_receivable" },
          { to: "/accounting?tab=collections", label: "Collections", icon: Target, permission: "view:accounts_receivable" },
          { to: "/accounting?tab=payment_reminders", label: "Payment Reminders", icon: BellRing, permission: "view:accounts_receivable" },
        ]
      },
      {
        to: "/accounting?tab=vendor_bills",
        label: "Payables",
        icon: CreditCard,
        permission: "view:accounts_payable",
        subItems: [
          { to: "/accounting?tab=vendor_bills", label: "Vendor Bills", icon: FileCheck, permission: "view:accounts_payable" },
          { to: "/accounting?tab=payments_made", label: "Payments", icon: Wallet, permission: "view:accounts_payable" },
          { to: "/accounting?tab=credit_notes", label: "Credit Notes", icon: FileCheck, permission: "view:accounts_payable" },
          { to: "/accounting?tab=debit_notes", label: "Debit Notes", icon: FileCheck, permission: "view:accounts_payable" },
          { to: "/accounting?tab=vendor_aging", label: "Vendor Aging", icon: Clock, permission: "view:accounts_payable" },
        ]
      },
      {
        to: "/accounting?tab=bank_accounts",
        label: "Banking",
        icon: Building2,
        permission: "view:bank_accounts",
        subItems: [
          { to: "/accounting?tab=bank_accounts", label: "Bank Accounts", icon: Building2, permission: "view:bank_accounts" },
          { to: "/accounting?tab=cash_accounts", label: "Cash Accounts", icon: CreditCard, permission: "view:bank_accounts" },
          { to: "/accounting?tab=reconciliation", label: "Reconciliation", icon: RefreshCw, permission: "view:bank_reconciliations" },
          { to: "/accounting?tab=bank_statements", label: "Bank Statements", icon: FileCheck, permission: "view:bank_transactions" },
        ]
      },
      {
        to: "/accounting?tab=gst",
        label: "Taxes",
        icon: Calculator,
        permission: "view:tax",
        subItems: [
          { to: "/accounting?tab=gst", label: "GST", icon: Calculator, permission: "view:tax" },
          { to: "/accounting?tab=tds", label: "TDS", icon: Calculator, permission: "view:tax" },
          { to: "/accounting?tab=vat", label: "VAT", icon: Calculator, permission: "view:tax" },
          { to: "/accounting?tab=tax_rules", label: "Tax Rules", icon: Sliders, permission: "view:tax" },
          { to: "/accounting?tab=tax_filing", label: "Tax Filing", icon: FileCheck, permission: "file:tax" },
        ]
      },
      {
        to: "/accounting?tab=fixed_assets",
        label: "Assets",
        icon: Boxes,
        permission: "view:fixed_assets",
        subItems: [
          { to: "/accounting?tab=fixed_assets", label: "Fixed Assets", icon: Boxes, permission: "view:fixed_assets" },
          { to: "/accounting?tab=asset_categories", label: "Asset Categories", icon: FolderTree, permission: "view:fixed_assets" },
          { to: "/accounting?tab=depreciation", label: "Depreciation", icon: TrendingUp, permission: "view:fixed_assets" },
          { to: "/accounting?tab=asset_register", label: "Asset Register", icon: FileCheck, permission: "view:fixed_assets" },
        ]
      },
      {
        to: "/accounting?tab=budgets",
        label: "Budgeting",
        icon: LineChart,
        permission: "view:budgets",
        subItems: [
          { to: "/accounting?tab=budgets", label: "Budgets", icon: PieChart, permission: "view:budgets" },
          { to: "/accounting?tab=forecasts", label: "Forecasts", icon: TrendingUp, permission: "view:budgets" },
          { to: "/accounting?tab=cost_allocation", label: "Cost Allocation", icon: Calculator, permission: "view:budgets" },
          { to: "/accounting?tab=financial_planning", label: "Financial Planning", icon: LineChart, permission: "view:budgets" },
        ]
      },
      {
        to: "/accounting?tab=expense_claims",
        label: "Expenses",
        icon: CreditCard,
        isHighlighted: true,
        permission: "view:expense_claims",
        subItems: [
          { to: "/accounting?tab=expense_claims", label: "Expense Claims", icon: CreditCard, permission: "view:expense_claims" },
          { to: "/accounting?tab=approvals", label: "Approvals", icon: ShieldCheck, permission: "approve:expense_claims" },
          { to: "/accounting?tab=travel", label: "Travel", icon: MapPin, permission: "view:expense_claims" },
          { to: "/accounting?tab=office_expenses", label: "Office Expenses", icon: Building2, permission: "view:expense_claims" },
          { to: "/accounting?tab=operational_expenses", label: "Operational Expenses", icon: Activity, permission: "view:expense_claims" },
        ]
      },
      {
        to: "/accounting?tab=revenue_analytics",
        label: "Financial Intelligence",
        icon: BrainCircuit,
        permission: "view:analytics",
        subItems: [
          { to: "/accounting?tab=revenue_analytics", label: "Revenue Analytics", icon: LineChart, permission: "view:analytics" },
          { to: "/accounting?tab=expense_analytics", label: "Expense Analytics", icon: PieChart, permission: "view:analytics" },
          { to: "/accounting?tab=profit_forecast", label: "Profit Forecast", icon: TrendingUp, permission: "view:analytics" },
          { to: "/accounting?tab=cash_forecast", label: "Cash Forecast", icon: TrendingUp, permission: "view:analytics" },
          { to: "/accounting?tab=ai_financial_insights", label: "AI Financial Insights", icon: Sparkles, permission: "view:analytics" },
        ]
      },
    ]
  },
  {
    group: "HRMS", theme: "rose", icon: UserCheck, permission: "view:hrms", items: [
      {
        to: "/hrms?tab=employees",
        label: "Employee Management",
        icon: Users,
        permission: "view:hrms_employees",
        subItems: [
          { to: "/hrms?tab=employees", label: "Employees", icon: UsersRound, permission: "view:hrms_employees" },
          { to: "/hrms?tab=departments", label: "Departments", icon: LibraryBig, permission: "view:hrms_departments" },
          { to: "/hrms?tab=designations", label: "Designations", icon: Target, permission: "view:hrms_designations" },
          { to: "/hrms?tab=teams", label: "Teams", icon: UsersRound, permission: "view:hrms_teams" },
          { to: "/hrms?tab=documents", label: "Documents", icon: FileCheck, permission: "view:hrms_documents" },
          { to: "/hrms?tab=employee_profile", label: "Employee Profile", icon: UserCog, permission: "view:hrms_profiles" },
        ]
      },
      {
        to: "/hrms?tab=daily_attendance",
        label: "Attendance",
        icon: Clock,
        permission: "view:hrms_attendance",
        subItems: [
          { to: "/hrms?tab=daily_attendance", label: "Daily Attendance", icon: Clock, permission: "view:hrms_attendance" },
          { to: "/hrms?tab=attendance_settings", label: "Attendance Settings / Work Calendars", icon: SlidersHorizontal, permission: "view:hrms_attendance" },
          { to: "/hrms?tab=biometric", label: "Biometric", icon: Fingerprint, permission: "view:hrms_biometric" },
          { to: "/hrms?tab=face_recognition", label: "Face Recognition", icon: Webcam, permission: "view:hrms_face" },
          { to: "/hrms?tab=gps_attendance", label: "GPS Attendance", icon: MapPin, permission: "view:hrms_gps" },
          { to: "/hrms?tab=travel_routes", label: "Field Travel Route Map & Radar", icon: Navigation, permission: "view:hrms_attendance" },
          { to: "/hrms?tab=shift_attendance", label: "Shift Attendance", icon: Clock, permission: "view:hrms_shifts" },
          { to: "/hrms?tab=attendance_corrections", label: "Attendance Corrections", icon: FileCheck, permission: "view:hrms_corrections" },
        ]
      },
      {
        to: "/hrms?tab=leave_requests",
        label: "Leave",
        icon: Calendar,
        permission: "view:hrms_leaves",
        subItems: [
          { to: "/hrms?tab=leave_requests", label: "Leave Requests", icon: Calendar, permission: "view:hrms_leaves" },
          { to: "/hrms?tab=leave_calendar", label: "Leave Calendar", icon: CalendarClock, permission: "view:hrms_leave_calendar" },
          { to: "/hrms?tab=leave_balance", label: "Leave Balance", icon: Calculator, permission: "view:hrms_leave_balance" },
          { to: "/hrms?tab=approvals", label: "Approvals", icon: ShieldCheck, permission: "view:hrms_leave_approvals" },
        ]
      },
      {
        to: "/hrms?tab=salary_structure",
        label: "Payroll",
        icon: CreditCard,
        permission: "view:hrms_salary_structure",
        subItems: [
          { to: "/hrms?tab=salary_structure", label: "Salary Structure", icon: Calculator, permission: "view:hrms_salary_structure" },
          { to: "/hrms?tab=payroll_processing", label: "Payroll Processing", icon: Clock, permission: "view:hrms_payroll_processing" },
          { to: "/hrms?tab=pf", label: "PF", icon: FileCheck, permission: "view:hrms_pf_esi" },
          { to: "/hrms?tab=esi", label: "ESI", icon: FileCheck, permission: "view:hrms_pf_esi" },
          { to: "/hrms?tab=tds", label: "TDS", icon: FileCheck, permission: "view:hrms_tds" },
          { to: "/hrms?tab=payslips", label: "Payslips", icon: FileCheck, permission: "view:hrms_payslips" },
          { to: "/hrms?tab=payslip_templates", label: "Payslip Studio", icon: Palette, permission: "view:hrms_payslips" },
          { to: "/hrms?tab=loans", label: "Loans", icon: CreditCard, permission: "view:hrms_loans_advances" },
          { to: "/hrms?tab=advances", label: "Advances", icon: CreditCard, permission: "view:hrms_loans_advances" },
          { to: "/hrms?tab=bonuses", label: "Bonuses", icon: Target, permission: "view:hrms_bonuses_commissions" },
          { to: "/hrms?tab=commissions", label: "Commissions", icon: Calculator, permission: "view:hrms_bonuses_commissions" },
        ]
      },
      {
        to: "/hrms?tab=job_openings",
        label: "Recruitment",
        icon: Briefcase,
        permission: "view:hrms_recruitment",
        subItems: [
          { to: "/hrms?tab=job_openings", label: "Job Openings", icon: BriefcaseBusiness, permission: "view:hrms_recruitment" },
          { to: "/hrms?tab=applicants", label: "Applicants", icon: Users, permission: "view:hrms_recruitment" },
          { to: "/hrms?tab=interviews", label: "Interviews", icon: Clock, permission: "view:hrms_recruitment" },
          { to: "/hrms?tab=offer_letters", label: "Offer Letters", icon: FileCheck, permission: "view:hrms_onboarding" },
          { to: "/hrms?tab=onboarding", label: "Onboarding", icon: Target, permission: "view:hrms_onboarding" },
        ]
      },
      {
        to: "/hrms?tab=goals",
        label: "Performance",
        icon: Target,
        permission: "view:hrms_performance",
        subItems: [
          { to: "/hrms?tab=goals", label: "Goals", icon: Target, permission: "view:hrms_performance" },
          { to: "/hrms?tab=kpis", label: "KPIs", icon: BarChart3, permission: "view:hrms_performance" },
          { to: "/hrms?tab=appraisals", label: "Appraisals", icon: Activity, permission: "view:hrms_performance" },
          { to: "/hrms?tab=performance_reviews", label: "Performance Reviews", icon: FileCheck, permission: "view:hrms_performance" },
          { to: "/hrms?tab=incentives", label: "Incentives", icon: CreditCard, permission: "view:hrms_performance" },
        ]
      },
      {
        to: "/hrms?tab=training",
        label: "Learning",
        icon: BrainCircuit,
        permission: "view:hrms_learning",
        subItems: [
          { to: "/hrms?tab=training", label: "Training", icon: Target, permission: "view:hrms_learning" },
          { to: "/hrms?tab=courses", label: "Courses", icon: FileCheck, permission: "view:hrms_learning" },
          { to: "/hrms?tab=certificates", label: "Certificates", icon: ShieldCheck, permission: "view:hrms_learning" },
          { to: "/hrms?tab=assessments", label: "Assessments", icon: FileCheck, permission: "view:hrms_learning" },
        ]
      },
      {
        to: "/hrms?tab=ess_attendance",
        label: "Employee Self Service",
        icon: UserCog,
        permission: "view:ess",
        subItems: [
          { to: "/hrms?tab=ess_attendance", label: "Attendance & Punch", icon: Clock, permission: "view:ess_attendance" },
          { to: "/hrms?tab=ess_leaves", label: "Leaves", icon: Calendar, permission: "view:ess_leaves" },
          { to: "/hrms?tab=ess_payroll", label: "Payroll", icon: CreditCard, permission: "view:ess_payroll" },
          { to: "/hrms?tab=ess_documents", label: "Documents", icon: FileCheck, permission: "view:ess_documents" },
          { to: "/hrms?tab=ess_tasks", label: "My Tasks", icon: Target, permission: "view:ess_tasks_announcements" },
          { to: "/hrms?tab=ess_performance", label: "Performance & Reviews", icon: Award, permission: "view:ess_tasks_announcements" },
          { to: "/hrms?tab=ess_learning", label: "Suggested Courses", icon: GraduationCap, permission: "view:ess_tasks_announcements" },
          { to: "/hrms?tab=ess_announcements", label: "Announcements", icon: Radio, permission: "view:ess_tasks_announcements" },
        ]
      },
      {
        to: "/hrms?tab=resignation",
        label: "Exit Management",
        icon: ArrowRightLeft,
        permission: "view:hrms_exit",
        subItems: [
          { to: "/hrms?tab=resignation", label: "Resignation", icon: FileCheck, permission: "view:hrms_exit" },
          { to: "/hrms?tab=clearance", label: "Clearance", icon: ShieldCheck, permission: "view:hrms_exit" },
          { to: "/hrms?tab=final_settlement", label: "Final Settlement", icon: Calculator, permission: "view:hrms_exit" },
          { to: "/hrms?tab=experience_letter", label: "Experience Letter", icon: FileCheck, permission: "view:hrms_exit" },
        ]
      },
      {
        to: "/hrms?tab=attendance_analytics",
        label: "HR Intelligence",
        icon: BrainCircuit,
        permission: "view:hrms_intelligence",
        subItems: [
          { to: "/hrms?tab=attendance_analytics", label: "Attendance Analytics", icon: PieChart, permission: "view:hrms_intelligence" },
          { to: "/hrms?tab=payroll_analytics", label: "Payroll Analytics", icon: LineChart, permission: "view:hrms_intelligence" },
          { to: "/hrms?tab=attrition_prediction", label: "Attrition Prediction", icon: Skull, permission: "view:hrms_intelligence" },
          { to: "/hrms?tab=shift_optimization", label: "Shift Optimization", icon: TrendingUp, permission: "view:hrms_intelligence" },
          { to: "/hrms?tab=productivity_score", label: "Productivity Score", icon: Activity, permission: "view:hrms_intelligence" },
          { to: "/hrms?tab=training_recommendation", label: "Training Recommendation", icon: Sparkles, permission: "view:hrms_intelligence" },
        ]
      },
    ]
  },
  {
    group: "IoT", theme: "zinc", icon: RadioTower, permission: "view:iot", items: [
      {
        to: "/iot?tab=connected_devices",
        label: "Devices",
        icon: Radio,
        permission: "view:iot_devices",
        subItems: [
          { to: "/iot?tab=connected_devices", label: "Connected Devices", icon: Signal, permission: "view:iot_devices" },
          { to: "/iot?tab=biometric_devices", label: "Biometric Devices", icon: ScanBarcode, permission: "view:iot_devices" },
          { to: "/iot?tab=barcode_scanners", label: "Barcode Scanners", icon: Barcode, permission: "view:iot_devices" },
          { to: "/iot?tab=rfid_readers", label: "RFID Readers", icon: Radio, permission: "view:iot_devices" },
          { to: "/iot?tab=face_recognition", label: "Face Recognition", icon: Webcam, permission: "view:iot_devices" },
          { to: "/iot?tab=gps_devices", label: "GPS Devices", icon: MapPin, permission: "view:iot_devices" },
          { to: "/iot?tab=sensors", label: "Sensors", icon: Microscope, permission: "view:iot_devices" },
        ]
      },
      {
        to: "/iot?tab=device_status",
        label: "Monitoring",
        icon: Activity,
        permission: "view:iot_telemetry",
        subItems: [
          { to: "/iot?tab=device_status", label: "Device Status", icon: Activity, permission: "view:iot_telemetry" },
          { to: "/iot?tab=health", label: "Health", icon: Activity, permission: "view:iot_telemetry" },
          { to: "/iot?tab=alerts", label: "Alerts", icon: Signal, permission: "view:iot_telemetry" },
          { to: "/iot?tab=device_logs", label: "Device Logs", icon: History, permission: "view:iot_telemetry" },
          { to: "/iot?tab=firmware", label: "Firmware", icon: Settings, permission: "view:iot_telemetry" },
          { to: "/iot?tab=connectivity", label: "Connectivity", icon: Network, permission: "view:iot_telemetry" },
        ]
      },
      {
        to: "/iot?tab=smart_shelves",
        label: "Smart Infrastructure",
        icon: Building2,
        permission: "view:iot",
        subItems: [
          { to: "/iot?tab=smart_shelves", label: "Smart Shelves", icon: Boxes, permission: "view:iot" },
          { to: "/iot?tab=temperature_sensors", label: "Temperature Sensors", icon: Activity, permission: "view:iot" },
          { to: "/iot?tab=weight_scales", label: "Weight Scales", icon: Scale, permission: "view:iot" },
          { to: "/iot?tab=smart_gates", label: "Smart Gates", icon: ShieldCheck, permission: "view:iot" },
          { to: "/iot?tab=cctv_analytics", label: "CCTV Analytics", icon: Target, permission: "view:iot" },
        ]
      },
      {
        to: "/iot?tab=employee_tracking",
        label: "Tracking",
        icon: MapPin,
        permission: "view:iot",
        subItems: [
          { to: "/iot?tab=employee_tracking", label: "Employee Tracking", icon: Users, permission: "view:iot" },
          { to: "/iot?tab=asset_tracking", label: "Asset Tracking", icon: Boxes, permission: "view:iot" },
          { to: "/iot?tab=vehicle_tracking", label: "Vehicle Tracking", icon: Truck, permission: "view:iot" },
          { to: "/iot?tab=warehouse_tracking", label: "Warehouse Tracking", icon: Warehouse, permission: "view:iot" },
        ]
      },
      {
        to: "/iot?tab=device_usage",
        label: "IoT Analytics",
        icon: BrainCircuit,
        permission: "view:analytics",
        subItems: [
          { to: "/iot?tab=device_usage", label: "Device Usage", icon: PieChart, permission: "view:analytics" },
          { to: "/iot?tab=device_health", label: "Device Health", icon: LineChart, permission: "view:analytics" },
          { to: "/iot?tab=heatmaps", label: "Heatmaps", icon: MapPin, permission: "view:analytics" },
          { to: "/iot?tab=movement_analytics", label: "Movement Analytics", icon: Activity, permission: "view:analytics" },
          { to: "/iot?tab=analytics_alerts", label: "Alerts", icon: Signal, permission: "view:analytics" },
        ]
      },
    ]
  },
  {
    group: "Reports", theme: "fuchsia", icon: BarChart3, permission: "view:reports", items: [
      {
        to: "/reports?tab=gst_reports",
        label: "GST & Tax",
        icon: ShieldCheck,
        permission: "view:reports",
        subItems: [
          { to: "/reports?tab=gst_gstr1", label: "GSTR-1 Outward Supplies", icon: FileSpreadsheet, permission: "view:reports" },
          { to: "/reports?tab=gst_gstr3b", label: "GSTR-3B Return", icon: FileCheck, permission: "view:reports" },
          { to: "/reports?tab=gst_gstr2b", label: "GSTR-2B Auto ITC", icon: Layers, permission: "view:reports" },
          { to: "/reports?tab=gst_sales", label: "GST Sales Register", icon: TrendingUp, permission: "view:reports" },
          { to: "/reports?tab=gst_purchase", label: "GST Purchase Register", icon: ShoppingBag, permission: "view:reports" },
          { to: "/reports?tab=gst_hsn_summary", label: "HSN / SAC Summary", icon: Tag, permission: "view:reports" },
          { to: "/reports?tab=gst_tax_summary", label: "Tax Rate Summary", icon: Percent, permission: "view:reports" },
          { to: "/reports?tab=gst_b2b", label: "B2B Invoices Report", icon: Building2, permission: "view:reports" },
          { to: "/reports?tab=gst_b2c", label: "B2C Sales Report", icon: Users, permission: "view:reports" },
          { to: "/reports?tab=gst_cdnr", label: "CDNR Credit/Debit Notes", icon: Receipt, permission: "view:reports" },
          { to: "/reports?tab=gst_itc", label: "ITC Tax Credit Register", icon: CheckCircle2, permission: "view:reports" },
          { to: "/reports?tab=gst_pos", label: "Place of Supply Report", icon: MapPin, permission: "view:reports" },
          { to: "/reports?tab=gst_reconciliation", label: "2B vs Purchase Reconcile", icon: RotateCcw, permission: "view:reports" },
          { to: "/reports?tab=tds_payable", label: "TDS / TCS Compliance", icon: Calculator, permission: "view:reports" },
        ]
      },
      {
        to: "/reports?tab=stock_reports",
        label: "Inventory & Stock",
        icon: Boxes,
        permission: "view:reports",
        subItems: [
          { to: "/reports?tab=stock_summary", label: "Stock Summary", icon: Boxes, permission: "view:reports" },
          { to: "/reports?tab=stock_detail", label: "Stock Item Detail", icon: FileText, permission: "view:reports" },
          { to: "/reports?tab=stock_godown", label: "Godown / Location Stock", icon: Warehouse, permission: "view:reports" },
          { to: "/reports?tab=item_batch", label: "Item Batch & Expiry", icon: Clock, permission: "view:reports" },
          { to: "/reports?tab=item_party", label: "Item-wise Party Movement", icon: Users, permission: "view:reports" },
          { to: "/reports?tab=item_sales_purchase_summary", label: "Sales & Purchase Summary", icon: ArrowRightLeft, permission: "view:reports" },
          { to: "/reports?tab=low_stock_summary", label: "Low Stock & Reorder", icon: AlertTriangle, permission: "view:reports" },
          { to: "/reports?tab=rate_list", label: "Price & Rate List", icon: Tag, permission: "view:reports" },
          { to: "/reports?tab=product_sales", label: "Product Sales Velocity", icon: TrendingUp, permission: "view:reports" },
          { to: "/reports?tab=product_profitability", label: "Product Profitability", icon: Percent, permission: "view:reports" },
          { to: "/reports?tab=abc_analysis_reports", label: "ABC Stock Analysis", icon: BarChart3, permission: "view:reports" },
          { to: "/reports?tab=xyz_analysis_reports", label: "XYZ Movement Analysis", icon: Activity, permission: "view:reports" },
        ]
      },
      {
        to: "/reports?tab=customer_reports",
        label: "Customers & Parties",
        icon: Users,
        permission: "view:reports",
        subItems: [
          { to: "/reports?tab=party_statement", label: "Party Statement / Ledger", icon: FileText, permission: "view:reports" },
          { to: "/reports?tab=party_outstanding", label: "Party Outstanding", icon: Landmark, permission: "view:reports" },
          { to: "/reports?tab=party_ageing", label: "Aging Analysis", icon: Clock, permission: "view:reports" },
          { to: "/reports?tab=party_item_report", label: "Party Item Report", icon: Boxes, permission: "view:reports" },
          { to: "/reports?tab=customer_sales", label: "Customer Sales Ranking", icon: TrendingUp, permission: "view:reports" },
        ]
      },
      {
        to: "/reports?tab=sales_reports",
        label: "Sales",
        icon: TrendingUp,
        permission: "view:reports",
        subItems: [
          { to: "/reports?tab=employee_sales_reports", label: "Employee-Wise Sales", icon: Users, permission: "view:reports" },
          { to: "/reports?tab=sales_reports", label: "Sales Reports", icon: TrendingUp, permission: "view:reports" },
          { to: "/reports?tab=revenue_reports", label: "Revenue Reports", icon: LineChart, permission: "view:reports" },
          { to: "/reports?tab=branch_reports", label: "Branch Reports", icon: Building2, permission: "view:reports" },
          { to: "/reports?tab=pos_reports", label: "POS Reports", icon: ShoppingCart, permission: "view:reports" },
        ]
      },
      {
        to: "/reports?tab=purchase_reports",
        label: "Procurement",
        icon: ShoppingBag,
        permission: "view:reports",
        subItems: [
          { to: "/reports?tab=purchase_reports", label: "Purchase Reports", icon: ShoppingBag, permission: "view:reports" },
          { to: "/reports?tab=supplier_reports", label: "Supplier Reports", icon: Truck, permission: "view:reports" },
          { to: "/reports?tab=grn_reports", label: "GRN Reports", icon: FileCheck, permission: "view:reports" },
          { to: "/reports?tab=spend_analysis_reports", label: "Spend Analysis", icon: Calculator, permission: "view:reports" },
        ]
      },
      {
        to: "/reports?tab=vendor_reports",
        label: "Marketplace",
        icon: Store,
        permission: "view:reports",
        subItems: [
          { to: "/reports?tab=vendor_reports", label: "Vendor Reports", icon: Store, permission: "view:reports" },
          { to: "/reports?tab=marketplace_revenue", label: "Marketplace Revenue", icon: LineChart, permission: "view:reports" },
          { to: "/reports?tab=delivery_reports", label: "Delivery Reports", icon: Truck, permission: "view:reports" },
          { to: "/reports?tab=order_reports", label: "Order Reports", icon: ShoppingCart, permission: "view:reports" },
        ]
      },
      {
        to: "/reports?tab=attendance_reports",
        label: "HR",
        icon: UserCog,
        permission: "view:reports",
        subItems: [
          { to: "/reports?tab=attendance_reports", label: "Attendance Reports", icon: Clock, permission: "view:reports" },
          { to: "/reports?tab=payroll_reports", label: "Payroll Reports", icon: CreditCard, permission: "view:reports" },
          { to: "/reports?tab=recruitment_reports", label: "Recruitment Reports", icon: Briefcase, permission: "view:reports" },
          { to: "/reports?tab=performance_reports", label: "Performance Reports", icon: Target, permission: "view:reports" },
        ]
      },
      {
        to: "/reports?tab=pnl_reports",
        label: "Finance",
        icon: Calculator,
        permission: "view:reports",
        subItems: [
          { to: "/reports?tab=pnl_reports", label: "P&L", icon: FileCheck, permission: "view:reports" },
          { to: "/reports?tab=balance_sheet_reports", label: "Balance Sheet", icon: FileCheck, permission: "view:reports" },
          { to: "/reports?tab=cash_flow_reports", label: "Cash Flow", icon: FileCheck, permission: "view:reports" },
          { to: "/reports?tab=expense_reports", label: "Expense Reports", icon: CreditCard, permission: "view:reports" },
        ]
      },
      {
        to: "/reports?tab=revenue_prediction",
        label: "AI Analytics",
        icon: BrainCircuit,
        permission: "view:ai_insights",
        subItems: [
          { to: "/reports?tab=revenue_prediction", label: "Revenue Prediction", icon: TrendingUp, permission: "view:ai_insights" },
          { to: "/reports?tab=demand_forecast_reports", label: "Demand Forecast", icon: TrendingUp, permission: "view:ai_insights" },
          { to: "/reports?tab=inventory_forecast", label: "Inventory Forecast", icon: Boxes, permission: "view:ai_insights" },
          { to: "/reports?tab=customer_prediction", label: "Customer Prediction", icon: Users, permission: "view:ai_insights" },
          { to: "/reports?tab=attrition_prediction_reports", label: "Attrition Prediction", icon: Skull, permission: "view:ai_insights" },
          { to: "/reports?tab=fraud_detection_reports", label: "Fraud Detection", icon: ShieldCheck, permission: "view:ai_insights" },
        ]
      },
    ]
  },
  {
    group: "Report Builder", theme: "violet", icon: SlidersHorizontal, permission: "view:report_builder", items: [
      {
        to: "/reports?tab=custom_reports",
        label: "Report Builder",
        icon: SlidersHorizontal,
        permission: "view:report_builder",
        subItems: [
          { to: "/reports?tab=custom_reports", label: "Reports Hub", icon: SlidersHorizontal, permission: "view:report_builder" },
          { to: "/reports?tab=saved_reports", label: "Saved Templates", icon: FileCheck, permission: "view:report_builder" },
          { to: "/reports?tab=scheduled_reports", label: "Scheduled Reports", icon: Clock, permission: "view:report_builder" },
          { to: "/reports?tab=exports", label: "Export Vault", icon: FileSpreadsheet, permission: "view:report_builder" },
        ]
      },
    ]
  },
  {
    group: "System Configuration", theme: "slate", icon: Settings, permission: "view:settings", items: [
      {
        to: "/settings?tab=company_profile",
        label: "Company",
        icon: Building2,
        permission: "view:settings",
        subItems: [
          { to: "/settings?tab=company_profile", label: "Company Profile", icon: Building2, permission: "view:settings" },
          { to: "/settings?tab=branch_settings", label: "Branch Settings", icon: MapPin, permission: "view:settings" },
          { to: "/settings?tab=branding", label: "Branding", icon: Image, permission: "view:settings" },
        ]
      },
      {
        to: "/settings?tab=user_preferences",
        label: "Users",
        icon: Users,
        permission: "view:settings",
        subItems: [
          { to: "/settings?tab=user_preferences", label: "User Preferences", icon: Settings, permission: "view:settings" },
          { to: "/settings?tab=notifications", label: "Notifications", icon: Radio, permission: "view:settings" },
          { to: "/settings?tab=language", label: "Language", icon: Settings, permission: "view:settings" },
          { to: "/settings?tab=timezone", label: "Timezone", icon: Clock, permission: "view:settings" },
        ]
      },
      {
        to: "/settings?tab=payment_gateways",
        label: "Integrations",
        icon: Network,
        permission: "view:webhooks",
        subItems: [
          { to: "/settings?tab=payment_gateways", label: "Payment Gateways", icon: CreditCard, permission: "view:webhooks" },
          { to: "/settings?tab=recruitment_integrations", label: "Recruitment Integrations", icon: Briefcase, permission: "view:webhooks" },
          { to: "/settings?tab=whatsapp_integration", label: "WhatsApp", icon: Network, permission: "view:webhooks" },
          { to: "/settings?tab=sms_integration", label: "SMS", icon: Radio, permission: "view:webhooks" },
          { to: "/settings?tab=email_integration", label: "Email", icon: Inbox, permission: "view:webhooks" },
          { to: "/settings?tab=google_integration", label: "Google", icon: Network, permission: "view:webhooks" },
          { to: "/settings?tab=microsoft_integration", label: "Microsoft", icon: Network, permission: "view:webhooks" },
          { to: "/settings?tab=webhooks", label: "Webhooks", icon: Network, permission: "view:webhooks" },
          { to: "/settings?tab=api_connections", label: "API Connections", icon: Network, permission: "view:webhooks" },
        ]
      },
      {
        to: "/settings?tab=antigravity_settings",
        label: "AI",
        icon: Sparkles,
        permission: "view:settings",
        subItems: [
          { to: "/settings?tab=antigravity_settings", label: "LazyMonkeyAI Settings", icon: Settings, permission: "view:settings" },
          { to: "/settings?tab=ai_models", label: "AI Models", icon: BrainCircuit, permission: "view:settings" },
          { to: "/settings?tab=ai_credits", label: "AI Credits", icon: CreditCard, permission: "view:settings" },
          { to: "/settings?tab=ai_permissions", label: "AI Permissions", icon: ShieldCheck, permission: "view:settings" },
          { to: "/settings?tab=prompt_templates", label: "Prompt Templates", icon: FileCheck, permission: "view:settings" },
        ]
      },
      {
        to: "/settings?tab=print_settings",
        label: "Print Settings",
        icon: Printer,
        badge: "New",
        permission: "view:document_templates",
        subItems: [
          { to: "/settings?tab=print_settings", label: "Print Settings Hub", icon: Printer, permission: "view:document_templates" },
          { to: "/settings?tab=thermal_print", label: "Thermal Receipt Settings", icon: Printer, permission: "view:document_templates" },
          { to: "/settings?tab=barcode_print", label: "Barcode Label Setup", icon: ScanBarcode, permission: "view:document_templates" },
        ]
      },
      {
        to: "/settings?tab=email_templates",
        label: "Notifications",
        icon: Radio,
        permission: "view:notification_templates",
        subItems: [
          { to: "/settings?tab=email_templates", label: "Email Templates", icon: FileCheck, permission: "view:notification_templates" },
          { to: "/settings?tab=sms_templates", label: "SMS Templates", icon: FileCheck, permission: "view:notification_templates" },
          { to: "/settings?tab=whatsapp_campaigns", label: "WhatsApp Campaigns", icon: Network, permission: "view:notification_templates" },
          { to: "/settings?tab=whatsapp_templates", label: "WhatsApp Templates", icon: FileCheck, permission: "view:notification_templates" },
          { to: "/settings?tab=push_notifications_settings", label: "Push Notifications", icon: Radio, permission: "view:notification_templates" },
        ]
      },
      {
        to: "/settings?tab=password_policies",
        label: "Security",
        icon: ShieldCheck,
        permission: "view:mfa_policies",
        subItems: [
          { to: "/settings?tab=password_policies", label: "Password Policies", icon: ShieldCheck, permission: "view:mfa_policies" },
          { to: "/settings?tab=mfa", label: "MFA", icon: ShieldCheck, permission: "view:mfa_policies" },
          { to: "/settings?tab=session_policies", label: "Session Policies", icon: ShieldCheck, permission: "view:mfa_policies" },
          { to: "/settings?tab=device_policies", label: "Device Policies", icon: ShieldCheck, permission: "view:mfa_policies" },
          { to: "/settings?tab=login_history", label: "Login History", icon: History, permission: "view:mfa_policies" },
        ]
      },
      {
        to: "/settings?tab=themes",
        label: "Appearance",
        icon: Image,
        permission: "view:settings",
        subItems: [
          { to: "/settings?tab=themes", label: "Themes", icon: Image, permission: "view:settings" },
          { to: "/settings?tab=dark_mode", label: "Dark Mode", icon: Image, permission: "view:settings" },
          { to: "/settings?tab=accent_colors", label: "Accent Colors", icon: Image, permission: "view:settings" },
          { to: "/settings?tab=logo", label: "Logo", icon: Image, permission: "view:settings" },
          { to: "/settings?tab=brand_assets", label: "Brand Assets", icon: Image, permission: "view:settings" },
        ]
      },
      {
        to: "/settings?tab=backup",
        label: "Backup",
        icon: History,
        permission: "view:backup",
        subItems: [
          { to: "/settings?tab=backup", label: "Backup", icon: History, permission: "view:backup" },
          { to: "/settings?tab=restore", label: "Restore", icon: History, permission: "view:backup" },
          { to: "/settings?tab=import", label: "Import", icon: ArrowDownToLine, permission: "view:backup" },
          { to: "/settings?tab=export", label: "Export", icon: FileCheck, permission: "view:backup" },
        ]
      },
      {
        to: "/settings?tab=subscription",
        label: "Licenses",
        icon: ShieldCheck,
        permission: "view:subscription",
        subItems: [
          { to: "/settings?tab=subscription", label: "Subscription", icon: ShieldCheck, permission: "view:subscription" },
          { to: "/settings?tab=storage", label: "Storage", icon: Database, permission: "view:subscription" },
          { to: "/settings?tab=ai_credits_usage", label: "AI Credits", icon: CreditCard, permission: "view:subscription" },
          { to: "/settings?tab=modules", label: "Modules", icon: Network, permission: "view:subscription" },
          { to: "/settings?tab=usage", label: "Usage", icon: Activity, permission: "view:subscription" },
        ]
      },
    ]
  }
];

export const GROUP_COLORS: Record<string, { text: string; gradient: string; glow: string }> = {
  "Workspace": { text: "text-blue-600 dark:text-blue-400", gradient: "bg-gradient-to-r from-blue-500 to-indigo-500", glow: "shadow-blue-500/25" },
  "Core ERP": { text: "text-indigo-600 dark:text-indigo-400", gradient: "bg-gradient-to-r from-indigo-500 to-purple-600", glow: "shadow-indigo-500/25" },
  "Inventory & Warehouse": { text: "text-emerald-600 dark:text-emerald-400", gradient: "bg-gradient-to-r from-emerald-500 to-teal-500", glow: "shadow-emerald-500/25" },
  "Purchase": { text: "text-cyan-600 dark:text-cyan-400", gradient: "bg-gradient-to-r from-cyan-500 to-sky-500", glow: "shadow-cyan-500/25" },
  "Operations": { text: "text-cyan-600 dark:text-cyan-400", gradient: "bg-gradient-to-r from-cyan-500 to-sky-500", glow: "shadow-cyan-500/25" },
  "Sales": { text: "text-purple-600 dark:text-purple-400", gradient: "bg-gradient-to-r from-purple-500 to-indigo-600", glow: "shadow-purple-500/25" },
  "CRM": { text: "text-rose-600 dark:text-rose-400", gradient: "bg-gradient-to-r from-rose-500 to-pink-600", glow: "shadow-rose-500/25" },
  "POS": { text: "text-purple-600 dark:text-purple-400", gradient: "bg-gradient-to-r from-purple-500 to-indigo-600", glow: "shadow-purple-500/25" },
  "Sales & CRM": { text: "text-rose-600 dark:text-rose-400", gradient: "bg-gradient-to-r from-rose-500 to-pink-600", glow: "shadow-rose-500/25" },
  "Marketplace": { text: "text-amber-600 dark:text-amber-400", gradient: "bg-gradient-to-r from-amber-500 to-orange-500", glow: "shadow-amber-500/25" },
  "Accounting & Finance": { text: "text-violet-600 dark:text-violet-400", gradient: "bg-gradient-to-r from-violet-500 to-fuchsia-600", glow: "shadow-violet-500/25" },
  "HRMS": { text: "text-pink-600 dark:text-pink-400", gradient: "bg-gradient-to-r from-pink-500 to-rose-500", glow: "shadow-pink-500/25" },
  "IoT": { text: "text-teal-600 dark:text-teal-400", gradient: "bg-gradient-to-r from-teal-500 to-cyan-600", glow: "shadow-teal-500/25" },
  "Reports": { text: "text-fuchsia-600 dark:text-fuchsia-400", gradient: "bg-gradient-to-r from-fuchsia-500 to-purple-600", glow: "shadow-fuchsia-500/25" },
  "Analytics & Intelligence": { text: "text-fuchsia-600 dark:text-fuchsia-400", gradient: "bg-gradient-to-r from-fuchsia-500 to-purple-600", glow: "shadow-fuchsia-500/25" },
  "Report Builder": { text: "text-violet-600 dark:text-violet-400", gradient: "bg-gradient-to-r from-violet-500 to-indigo-600", glow: "shadow-violet-500/25" },
  "System Configuration": { text: "text-slate-600 dark:text-slate-400", gradient: "bg-gradient-to-r from-slate-500 to-gray-600", glow: "shadow-slate-500/20" },
};
