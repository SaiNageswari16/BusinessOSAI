import {
  LayoutDashboard, Sparkles, Boxes, Warehouse, ShoppingCart, ShoppingBag,
  Users, Store, Calculator, UserCog, Radio, BarChart3, Settings, Building2, Truck, ShieldCheck, MapPin,
  Briefcase, Target, Network, CreditCard, Calendar, Laptop, History, Activity, Clock, FileCheck,
  Package, FolderTree, Layers, Tags, Scale, SlidersHorizontal, Combine, PackagePlus, Blocks, Image, ArrowRightLeft,
  Sliders, RotateCw, RefreshCw, ClipboardCheck, Grid, Columns, Inbox, ArrowDownToLine, ListChecks, Hash, Barcode, CalendarX,
  CalendarClock, ScanBarcode, QrCode, AlertTriangle, TrendingUp, Snail, Rocket, Skull, PieChart, LineChart, BrainCircuit, Database, Banknote, Lock, Monitor
} from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  icon: any;
  badge?: string;
  permission?: string;
  subItems?: { to: string; label: string; icon: any; permission?: string }[];
};

type NavGroup = {
  group: string;
  permission?: string;
  items: NavItem[];
};

export const nav: NavGroup[] = [
  {
    group: "Workspace", items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "view:dashboard" },
      { to: "/copilot", label: "Antigravity AI", icon: Sparkles, badge: "OS", permission: "view:copilot" },
    ]
  },
  {
    group: "Core ERP", permission: "view:erp", items: [
      {
        to: "/erp?tab=companies",
        label: "Organization",
        icon: Building2,
        subItems: [
          { to: "/erp?tab=companies", label: "Companies", icon: Building2 },
          { to: "/erp?tab=business_units", label: "Business Units", icon: Network },
          { to: "/erp?tab=regions", label: "Regions", icon: MapPin },
          { to: "/erp?tab=zones", label: "Zones", icon: MapPin },
          { to: "/erp?tab=branches", label: "Branches", icon: MapPin },
          { to: "/erp?tab=departments", label: "Departments", icon: Briefcase },
          { to: "/erp?tab=designations", label: "Designations", icon: Target },
          { to: "/erp?tab=teams", label: "Teams", icon: Users },
          { to: "/erp?tab=org_structure", label: "Organization Structure", icon: Network },
        ]
      },
      {
        to: "/erp?tab=fiscal_years",
        label: "Financial Configuration",
        icon: CreditCard,
        subItems: [
          { to: "/erp?tab=fiscal_years", label: "Fiscal Years", icon: Calendar },
          { to: "/erp?tab=cost_centers", label: "Cost Centers", icon: CreditCard },
          { to: "/erp?tab=currencies", label: "Currency Management", icon: Calculator },
          { to: "/erp?tab=taxes", label: "Tax Configuration", icon: Calculator },
          { to: "/erp?tab=payment_terms", label: "Payment Terms", icon: CreditCard },
          { to: "/erp?tab=number_series", label: "Number Series", icon: Calculator },
        ]
      },
      {
        to: "/erp?tab=users",
        label: "Access & Security",
        icon: ShieldCheck,
        subItems: [
          { to: "/erp?tab=users", label: "Users", icon: Users },
          { to: "/erp?tab=roles", label: "Roles", icon: ShieldCheck },
          { to: "/erp?tab=permission_matrix", label: "Permission Matrix", icon: ShieldCheck },
          { to: "/erp?tab=workspaces", label: "Workspaces", icon: Laptop },
          { to: "/erp?tab=subscriptions", label: "Subscription & License", icon: ShieldCheck },
          { to: "/erp?tab=api_keys", label: "API Keys", icon: Network },
          { to: "/erp?tab=mfa_policies", label: "MFA Policies", icon: ShieldCheck },
        ]
      },
      {
        to: "/erp?tab=approval_workflows",
        label: "Workflow Engine",
        icon: Network,
        subItems: [
          { to: "/erp?tab=approval_workflows", label: "Approval Workflows", icon: Network },
          { to: "/erp?tab=notification_templates", label: "Notification Templates", icon: Radio },
          { to: "/erp?tab=document_templates", label: "Document Templates", icon: Briefcase },
          { to: "/erp?tab=custom_fields", label: "Custom Fields", icon: Target },
          { to: "/erp?tab=automation_rules", label: "Automation Rules", icon: Settings },
        ]
      },
      {
        to: "/erp?tab=geography",
        label: "Master Data",
        icon: MapPin,
        subItems: [
          { to: "/erp?tab=geography", label: "Geography (Countries/States/Cities)", icon: MapPin },
          { to: "/erp?tab=locations", label: "Locations", icon: MapPin },
          { to: "/erp?tab=calendars_shifts", label: "Calendars & Shifts", icon: Calendar },
          { to: "/erp?tab=tags_labels", label: "Tags & Labels", icon: Target },
        ]
      },
      {
        to: "/erp?tab=audit_logs",
        label: "System Administration",
        icon: Settings,
        subItems: [
          { to: "/erp?tab=global_users", label: "Global Users", icon: Users },
          { to: "/erp?tab=audit_logs", label: "Audit Logs", icon: History },
          { to: "/erp?tab=activity_logs", label: "Activity Logs", icon: Activity },
          { to: "/erp?tab=error_logs", label: "Error Logs", icon: Activity },
          { to: "/erp?tab=system_health", label: "System Health", icon: Activity },
          { to: "/erp?tab=backup_restore", label: "Backup & Restore", icon: History },
          { to: "/erp?tab=global_settings", label: "Global Settings", icon: Settings },
        ]
      }
    ]
  },
  {
    group: "Inventory & Warehouse", permission: "view:inventory", items: [
      {
        to: "/inventory?tab=products",
        label: "Product Master",
        icon: Boxes,
        subItems: [
          { to: "/inventory?tab=products", label: "Products", icon: Package },
          { to: "/inventory?tab=categories", label: "Categories", icon: FolderTree },
          { to: "/inventory?tab=subcategories", label: "Sub Categories", icon: Layers },
          { to: "/inventory?tab=brands", label: "Brands", icon: Tags },
          { to: "/inventory?tab=units", label: "Units of Measure", icon: Scale },
          { to: "/inventory?tab=attributes", label: "Product Attributes", icon: SlidersHorizontal },
          { to: "/inventory?tab=variants", label: "Product Variants", icon: Combine },
          { to: "/inventory?tab=bundles", label: "Product Bundles", icon: PackagePlus },
          { to: "/inventory?tab=kits", label: "Product Kits", icon: Blocks },
          { to: "/inventory?tab=images", label: "Product Images", icon: Image },
        ]
      },
      {
        to: "/inventory?tab=stock_overview",
        label: "Inventory Operations",
        icon: Activity,
        subItems: [
          { to: "/inventory?tab=stock_overview", label: "Stock Overview", icon: BarChart3 },
          { to: "/inventory?tab=stock_movement", label: "Stock Movement", icon: ArrowRightLeft },
          { to: "/inventory?tab=stock_adjustment", label: "Stock Adjustment", icon: Sliders },
          { to: "/inventory?tab=stock_transfer", label: "Stock Transfer", icon: Truck },
          { to: "/inventory?tab=cycle_counting", label: "Cycle Counting", icon: RotateCw },
          { to: "/inventory?tab=physical_audit", label: "Physical Stock Audit", icon: ClipboardCheck },
        ]
      },
      {
        to: "/inventory?tab=warehouses",
        label: "Warehouse Management",
        icon: Warehouse,
        permission: "view:warehouse",
        subItems: [
          { to: "/inventory?tab=warehouses", label: "Warehouses", icon: Warehouse },
          { to: "/inventory?tab=storage_locations", label: "Storage Locations", icon: MapPin },
          { to: "/inventory?tab=zones", label: "Zones", icon: Grid },
          { to: "/inventory?tab=racks", label: "Racks", icon: Columns },
          { to: "/inventory?tab=bins", label: "Bins", icon: Inbox },
          { to: "/inventory?tab=put_away_rules", label: "Put Away Rules", icon: ArrowDownToLine },
          { to: "/inventory?tab=picking_rules", label: "Picking Rules", icon: ListChecks },
        ]
      },
      {
        to: "/inventory?tab=batches",
        label: "Batch & Traceability",
        icon: Hash,
        subItems: [
          { to: "/inventory?tab=batches", label: "Batch Numbers", icon: Hash },
          { to: "/inventory?tab=serials", label: "Serial Numbers", icon: Barcode },
          { to: "/inventory?tab=expiry", label: "Expiry Management", icon: CalendarX },
          { to: "/inventory?tab=mfg_dates", label: "Manufacturing Dates", icon: CalendarClock },
          { to: "/inventory?tab=barcodes", label: "Barcode Management", icon: ScanBarcode },
          { to: "/inventory?tab=qrcodes", label: "QR Code Management", icon: QrCode },
          { to: "/inventory?tab=rfid", label: "RFID Management", icon: Radio },
        ]
      },
      {
        to: "/inventory?tab=low_stock",
        label: "Inventory Intelligence",
        icon: BrainCircuit,
        subItems: [
          { to: "/inventory?tab=low_stock", label: "Low Stock Alerts", icon: AlertTriangle },
          { to: "/inventory?tab=reorder_planning", label: "Reorder Planning", icon: TrendingUp },
          { to: "/inventory?tab=slow_moving", label: "Slow Moving Inventory", icon: Snail },
          { to: "/inventory?tab=fast_moving", label: "Fast Moving Inventory", icon: Rocket },
          { to: "/inventory?tab=dead_stock", label: "Dead Stock", icon: Skull },
          { to: "/inventory?tab=abc_analysis", label: "ABC Analysis", icon: PieChart },
          { to: "/inventory?tab=xyz_analysis", label: "XYZ Analysis", icon: LineChart },
          { to: "/inventory?tab=forecast", label: "Inventory Forecast", icon: BrainCircuit },
        ]
      },
    ]
  },
  {
    group: "Operations", items: [
      {
        to: "/procurement?tab=suppliers",
        label: "Supplier Management",
        icon: Truck,
        permission: "view:procurement",
        subItems: [
          { to: "/procurement?tab=suppliers", label: "Suppliers", icon: Store },
          { to: "/procurement?tab=supplier_categories", label: "Supplier Categories", icon: Layers },
          { to: "/procurement?tab=supplier_contacts", label: "Supplier Contacts", icon: Users },
          { to: "/procurement?tab=supplier_contracts", label: "Supplier Contracts", icon: Briefcase },
          { to: "/procurement?tab=supplier_performance", label: "Supplier Performance", icon: Activity },
          { to: "/procurement?tab=supplier_ratings", label: "Supplier Ratings", icon: Target },
          { to: "/procurement?tab=blacklisted_suppliers", label: "Blacklisted Suppliers", icon: ShieldCheck },
        ]
      },
      {
        to: "/procurement?tab=purchase_requests",
        label: "Procurement",
        icon: ShoppingBag,
        permission: "view:procurement",
        subItems: [
          { to: "/procurement?tab=purchase_requests", label: "Purchase Requests", icon: Package },
          { to: "/procurement?tab=purchase_quotations", label: "Purchase Quotations (RFQ)", icon: Network },
          { to: "/procurement?tab=purchase_orders", label: "Purchase Orders", icon: Truck },
          { to: "/procurement?tab=purchase_approvals", label: "Purchase Approvals", icon: ShieldCheck },
          { to: "/procurement?tab=goods_received_notes", label: "Goods Received Notes (GRN)", icon: Boxes },
          { to: "/procurement?tab=purchase_returns", label: "Purchase Returns", icon: ArrowRightLeft },
        ]
      },
      {
        to: "/procurement?tab=vendor_bills",
        label: "Vendor Payments",
        icon: CreditCard,
        permission: "view:procurement",
        subItems: [
          { to: "/procurement?tab=vendor_bills", label: "Bills", icon: CreditCard },
          { to: "/procurement?tab=pending_payments", label: "Pending Payments", icon: Clock },
          { to: "/procurement?tab=payment_history", label: "Payment History", icon: History },
          { to: "/procurement?tab=credit_notes", label: "Credit Notes", icon: FileCheck },
          { to: "/procurement?tab=debit_notes", label: "Debit Notes", icon: FileCheck },
        ]
      },
      {
        to: "/procurement?tab=spend_analysis",
        label: "Procurement Intelligence",
        icon: BrainCircuit,
        permission: "view:procurement",
        subItems: [
          { to: "/procurement?tab=spend_analysis", label: "Spend Analysis", icon: BarChart3 },
          { to: "/procurement?tab=vendor_analytics", label: "Vendor Analytics", icon: LineChart },
          { to: "/procurement?tab=ai_purchase_suggestions", label: "AI Purchase Suggestions", icon: Sparkles },
          { to: "/procurement?tab=lead_time_analysis", label: "Lead Time Analysis", icon: Clock },
          { to: "/procurement?tab=cost_analysis", label: "Cost Analysis", icon: Calculator },
          { to: "/procurement?tab=procurement_forecast", label: "Procurement Forecast", icon: TrendingUp },
        ]
      },
    ]
  },
  {
    group: "POS", permission: "view:pos", items: [
      { to: "/pos?tab=dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/pos?tab=terminal", label: "Terminal", icon: ShoppingCart },
      {
        to: "/pos?tab=sales",
        label: "Sales",
        icon: TrendingUp,
        subItems: [
          { to: "/pos?tab=sales", label: "All Orders", icon: ShoppingCart },
          { to: "/pos?tab=sales&view=held", label: "Held Orders", icon: Clock },
          { to: "/pos?tab=sales&view=completed", label: "Completed", icon: FileCheck },
          { to: "/pos?tab=sales&view=cancelled", label: "Cancelled", icon: AlertTriangle },
          { to: "/pos?tab=sales&view=today", label: "Today's Sales", icon: TrendingUp },
          { to: "/pos?tab=sales&view=history", label: "Sales History", icon: History },
          { to: "/pos?tab=sales&view=invoices", label: "Invoices", icon: FileCheck },
        ]
      },
      {
        to: "/pos?tab=customers",
        label: "Customers",
        icon: Users,
        subItems: [
          { to: "/pos?tab=customers&view=walk_in", label: "Walk-in Customer", icon: UserCog },
          { to: "/pos?tab=customers&view=search", label: "Customer Search", icon: Users },
          { to: "/pos?tab=customers&view=loyalty", label: "Loyalty", icon: Tags },
          { to: "/pos?tab=customers&view=membership", label: "Membership", icon: ShieldCheck },
          { to: "/pos?tab=customers&view=wallet", label: "Wallet", icon: CreditCard },
          { to: "/pos?tab=customers&view=gift_cards", label: "Gift Cards", icon: CreditCard },
          { to: "/pos?tab=customers&view=history", label: "Purchase History", icon: History },
        ]
      },
      {
        to: "/pos?tab=payments",
        label: "Payments",
        icon: CreditCard,
        subItems: [
          { to: "/pos?tab=payments&view=cash", label: "Cash", icon: Banknote },
          { to: "/pos?tab=payments&view=card", label: "Card", icon: CreditCard },
          { to: "/pos?tab=payments&view=upi", label: "UPI", icon: QrCode },
          { to: "/pos?tab=payments&view=split", label: "Split Payment", icon: Combine },
          { to: "/pos?tab=payments&view=refunds", label: "Refund History", icon: History },
        ]
      },
      {
        to: "/pos?tab=store_operations",
        label: "Store Operations",
        icon: Store,
        subItems: [
          { to: "/pos?tab=store_operations&view=shift", label: "Open/Close Shift", icon: Clock },
          { to: "/pos?tab=store_operations&view=drawer", label: "Cash Drawer", icon: Store },
          { to: "/pos?tab=store_operations&view=cash_io", label: "Cash In/Out", icon: ArrowRightLeft },
          { to: "/pos?tab=store_operations&view=register", label: "Register Closing", icon: Lock },
          { to: "/pos?tab=store_operations&view=eod", label: "End Of Day", icon: CalendarX },
        ]
      },
      {
        to: "/pos?tab=returns",
        label: "Returns & Exchange",
        icon: ArrowRightLeft,
        subItems: [
          { to: "/pos?tab=returns&view=returns", label: "Returns", icon: ArrowRightLeft },
          { to: "/pos?tab=returns&view=exchange", label: "Exchange", icon: RefreshCw },
          { to: "/pos?tab=returns&view=refund", label: "Refund", icon: CreditCard },
          { to: "/pos?tab=returns&view=store_credit", label: "Store Credit", icon: FileCheck },
          { to: "/pos?tab=returns&view=damaged", label: "Damaged Products", icon: AlertTriangle },
        ]
      },
      {
        to: "/pos?tab=devices",
        label: "Devices",
        icon: ScanBarcode,
        subItems: [
          { to: "/pos?tab=devices&view=barcode", label: "Barcode Scanner", icon: Barcode },
          { to: "/pos?tab=devices&view=printer", label: "Receipt Printer", icon: FileCheck },
          { to: "/pos?tab=devices&view=drawer", label: "Cash Drawer", icon: Store },
          { to: "/pos?tab=devices&view=display", label: "Pole Display", icon: Monitor },
          { to: "/pos?tab=devices&view=scale", label: "Weight Scale", icon: Scale },
        ]
      },
      {
        to: "/pos?tab=reports",
        label: "Reports",
        icon: BarChart3,
        subItems: [
          { to: "/pos?tab=reports&view=sales", label: "Daily/Hourly Sales", icon: LineChart },
          { to: "/pos?tab=reports&view=cash", label: "Cash Report", icon: PieChart },
          { to: "/pos?tab=reports&view=payment", label: "Payment Report", icon: BarChart3 },
          { to: "/pos?tab=reports&view=tax", label: "Tax Report", icon: Calculator },
          { to: "/pos?tab=reports&view=shift", label: "Shift Report", icon: Clock },
        ]
      },
      {
        to: "/pos?tab=ai_assistant",
        label: "AI Assistant",
        icon: Sparkles,
        subItems: [
          { to: "/pos?tab=ai_assistant&view=summary", label: "Sales Summary", icon: Sparkles },
          { to: "/pos?tab=ai_assistant&view=peak", label: "Peak Hours Prediction", icon: TrendingUp },
          { to: "/pos?tab=ai_assistant&view=fraud", label: "Fraud Detection", icon: ShieldCheck },
          { to: "/pos?tab=ai_assistant&view=alerts", label: "Inventory Alerts", icon: AlertTriangle },
        ]
      },
    ]
  },
  {
    group: "Sales & CRM", permission: "view:crm", items: [
      {
        to: "/crm?tab=customers",
        label: "Customer Management",
        icon: Users,
        subItems: [
          { to: "/crm?tab=customers", label: "Customers", icon: Users },
          { to: "/crm?tab=customer_groups", label: "Customer Groups", icon: Network },
          { to: "/crm?tab=customer_segments", label: "Customer Segments", icon: Target },
          { to: "/crm?tab=membership_plans", label: "Membership Plans", icon: ShieldCheck },
          { to: "/crm?tab=customer_wallet", label: "Customer Wallet", icon: CreditCard },
          { to: "/crm?tab=loyalty_program", label: "Loyalty Program", icon: Tags },
          { to: "/crm?tab=customer_documents", label: "Customer Documents", icon: Briefcase },
        ]
      },
      {
        to: "/crm?tab=ad_generator",
        label: "Sales CRM",
        icon: TrendingUp,
        subItems: [
          { to: "/crm?tab=ad_generator", label: "Ad Generator", icon: Sparkles },
          { to: "/crm?tab=leads", label: "Leads", icon: UserCog },
          { to: "/crm?tab=opportunities", label: "Opportunities", icon: Rocket },
          { to: "/crm?tab=deals", label: "Deals", icon: Target },
          { to: "/crm?tab=sales_pipeline", label: "Sales Pipeline", icon: BarChart3 },
          { to: "/crm?tab=quotations", label: "Quotations", icon: FileCheck },
          { to: "/crm?tab=sales_orders", label: "Sales Orders", icon: ShoppingCart },
        ]
      },
      {
        to: "/crm?tab=support_tickets",
        label: "Customer Service",
        icon: Activity,
        subItems: [
          { to: "/crm?tab=support_tickets", label: "Support Tickets", icon: AlertTriangle },
          { to: "/crm?tab=complaints", label: "Complaints", icon: Activity },
          { to: "/crm?tab=returns", label: "Returns", icon: ArrowRightLeft },
          { to: "/crm?tab=feedback", label: "Feedback", icon: Sparkles },
          { to: "/crm?tab=customer_timeline", label: "Customer Timeline", icon: History },
        ]
      },
      {
        to: "/crm?tab=email_campaigns",
        label: "Communication",
        icon: Radio,
        subItems: [
          { to: "/crm?tab=email_campaigns", label: "Email Campaigns", icon: Inbox },
          { to: "/crm?tab=sms_campaigns", label: "SMS Campaigns", icon: Radio },
          { to: "/crm?tab=whatsapp_campaigns", label: "WhatsApp Campaigns", icon: Network },
          { to: "/crm?tab=push_notifications", label: "Push Notifications", icon: Radio },
        ]
      },
      {
        to: "/crm?tab=customer_analytics",
        label: "Customer Intelligence",
        icon: BrainCircuit,
        subItems: [
          { to: "/crm?tab=customer_analytics", label: "Customer Analytics", icon: PieChart },
          { to: "/crm?tab=purchase_behaviour", label: "Purchase Behaviour", icon: Activity },
          { to: "/crm?tab=churn_prediction", label: "Churn Prediction", icon: Skull },
          { to: "/crm?tab=lifetime_value", label: "Lifetime Value", icon: LineChart },
          { to: "/crm?tab=rfm_analysis", label: "RFM Analysis", icon: Grid },
          { to: "/crm?tab=ai_recommendations", label: "AI Recommendations", icon: Sparkles },
        ]
      },
    ]
  },
  {
    group: "Marketplace", items: [
      {
        to: "/marketplace?tab=vendors",
        label: "Vendor Management",
        icon: Store,
        subItems: [
          { to: "/marketplace?tab=vendors", label: "Vendors", icon: Store },
          { to: "/marketplace?tab=vendor_categories", label: "Vendor Categories", icon: FolderTree },
          { to: "/marketplace?tab=vendor_contracts", label: "Vendor Contracts", icon: FileCheck },
          { to: "/marketplace?tab=vendor_wallet", label: "Vendor Wallet", icon: CreditCard },
          { to: "/marketplace?tab=vendor_payouts", label: "Vendor Payouts", icon: Clock },
          { to: "/marketplace?tab=vendor_ratings", label: "Vendor Ratings", icon: Target },
          { to: "/marketplace?tab=vendor_performance", label: "Vendor Performance", icon: Activity },
          { to: "/marketplace?tab=vendor_kyc", label: "Vendor KYC", icon: ShieldCheck },
          { to: "/marketplace?tab=vendor_approvals", label: "Vendor Approvals", icon: ShieldCheck },
        ]
      },
      {
        to: "/marketplace?tab=marketplace_products",
        label: "Marketplace Products",
        icon: Package,
        subItems: [
          { to: "/marketplace?tab=marketplace_products", label: "Marketplace Products", icon: Package },
          { to: "/marketplace?tab=marketplace_categories", label: "Marketplace Categories", icon: FolderTree },
          { to: "/marketplace?tab=marketplace_services", label: "Marketplace Services", icon: Briefcase },
          { to: "/marketplace?tab=product_approval", label: "Product Approval", icon: ShieldCheck },
          { to: "/marketplace?tab=pricing_rules", label: "Pricing Rules", icon: Calculator },
          { to: "/marketplace?tab=bundles", label: "Bundles", icon: PackagePlus },
          { to: "/marketplace?tab=featured_products", label: "Featured Products", icon: Sparkles },
        ]
      },
      {
        to: "/marketplace?tab=orders",
        label: "Orders",
        icon: ShoppingCart,
        subItems: [
          { to: "/marketplace?tab=orders", label: "Orders", icon: ShoppingCart },
          { to: "/marketplace?tab=returns", label: "Returns", icon: ArrowRightLeft },
          { to: "/marketplace?tab=refunds", label: "Refunds", icon: CreditCard },
          { to: "/marketplace?tab=cancellations", label: "Cancellations", icon: AlertTriangle },
          { to: "/marketplace?tab=order_timeline", label: "Order Timeline", icon: History },
          { to: "/marketplace?tab=invoices", label: "Invoices", icon: FileCheck },
          { to: "/marketplace?tab=order_tracking", label: "Order Tracking", icon: MapPin },
        ]
      },
      {
        to: "/marketplace?tab=delivery_partners",
        label: "Delivery",
        icon: Truck,
        subItems: [
          { to: "/marketplace?tab=delivery_partners", label: "Delivery Partners", icon: Truck },
          { to: "/marketplace?tab=drivers", label: "Drivers", icon: Users },
          { to: "/marketplace?tab=delivery_assignment", label: "Delivery Assignment", icon: Network },
          { to: "/marketplace?tab=delivery_tracking", label: "Delivery Tracking", icon: MapPin },
          { to: "/marketplace?tab=hyperlocal_delivery", label: "Hyperlocal Delivery", icon: MapPin },
          { to: "/marketplace?tab=shipping_rules", label: "Shipping Rules", icon: Sliders },
          { to: "/marketplace?tab=route_planning", label: "Route Planning", icon: MapPin },
        ]
      },
      {
        to: "/marketplace?tab=coupons",
        label: "Promotions",
        icon: Tags,
        subItems: [
          { to: "/marketplace?tab=coupons", label: "Coupons", icon: Tags },
          { to: "/marketplace?tab=offers", label: "Offers", icon: Target },
          { to: "/marketplace?tab=campaigns", label: "Campaigns", icon: Radio },
          { to: "/marketplace?tab=flash_sales", label: "Flash Sales", icon: Sparkles },
          { to: "/marketplace?tab=wallet", label: "Wallet", icon: CreditCard },
          { to: "/marketplace?tab=loyalty", label: "Loyalty", icon: Users },
          { to: "/marketplace?tab=gift_cards", label: "Gift Cards", icon: CreditCard },
        ]
      },
      {
        to: "/marketplace?tab=demand_forecast",
        label: "Marketplace Intelligence",
        icon: BrainCircuit,
        subItems: [
          { to: "/marketplace?tab=demand_forecast", label: "Demand Forecast", icon: TrendingUp },
          { to: "/marketplace?tab=dynamic_pricing", label: "Dynamic Pricing", icon: Calculator },
          { to: "/marketplace?tab=vendor_analytics", label: "Vendor Analytics", icon: LineChart },
          { to: "/marketplace?tab=product_analytics", label: "Product Analytics", icon: PieChart },
          { to: "/marketplace?tab=fraud_detection", label: "Fraud Detection", icon: Skull },
          { to: "/marketplace?tab=ai_recommendations", label: "AI Recommendations", icon: Sparkles },
        ]
      },
    ]
  },
  {
    group: "Accounting & Finance", permission: "view:accounting", items: [
      {
        to: "/accounting?tab=chart_of_accounts",
        label: "Accounting",
        icon: Calculator,
        subItems: [
          { to: "/accounting?tab=chart_of_accounts", label: "Chart of Accounts", icon: FolderTree },
          { to: "/accounting?tab=general_ledger", label: "General Ledger", icon: FileCheck },
          { to: "/accounting?tab=journal_entries", label: "Journal Entries", icon: FileCheck },
          { to: "/accounting?tab=opening_balances", label: "Opening Balances", icon: Calculator },
          { to: "/accounting?tab=closing_entries", label: "Closing Entries", icon: FileCheck },
        ]
      },
      {
        to: "/accounting?tab=customers",
        label: "Receivables",
        icon: CreditCard,
        subItems: [
          { to: "/accounting?tab=customers", label: "Customers", icon: Users },
          { to: "/accounting?tab=invoices", label: "Invoices", icon: FileCheck },
          { to: "/accounting?tab=payments", label: "Payments", icon: CreditCard },
          { to: "/accounting?tab=outstanding", label: "Outstanding", icon: Clock },
          { to: "/accounting?tab=collections", label: "Collections", icon: Target },
        ]
      },
      {
        to: "/accounting?tab=vendor_bills",
        label: "Payables",
        icon: CreditCard,
        subItems: [
          { to: "/accounting?tab=vendor_bills", label: "Vendor Bills", icon: FileCheck },
          { to: "/accounting?tab=payments_made", label: "Payments", icon: CreditCard },
          { to: "/accounting?tab=credit_notes", label: "Credit Notes", icon: FileCheck },
          { to: "/accounting?tab=debit_notes", label: "Debit Notes", icon: FileCheck },
          { to: "/accounting?tab=vendor_aging", label: "Vendor Aging", icon: Clock },
        ]
      },
      {
        to: "/accounting?tab=bank_accounts",
        label: "Banking",
        icon: Building2,
        subItems: [
          { to: "/accounting?tab=bank_accounts", label: "Bank Accounts", icon: Building2 },
          { to: "/accounting?tab=cash_accounts", label: "Cash Accounts", icon: CreditCard },
          { to: "/accounting?tab=reconciliation", label: "Reconciliation", icon: RefreshCw },
          { to: "/accounting?tab=bank_statements", label: "Bank Statements", icon: FileCheck },
        ]
      },
      {
        to: "/accounting?tab=gst",
        label: "Taxes",
        icon: Calculator,
        subItems: [
          { to: "/accounting?tab=gst", label: "GST", icon: Calculator },
          { to: "/accounting?tab=tds", label: "TDS", icon: Calculator },
          { to: "/accounting?tab=vat", label: "VAT", icon: Calculator },
          { to: "/accounting?tab=tax_rules", label: "Tax Rules", icon: Sliders },
          { to: "/accounting?tab=tax_filing", label: "Tax Filing", icon: FileCheck },
        ]
      },
      {
        to: "/accounting?tab=fixed_assets",
        label: "Assets",
        icon: Boxes,
        subItems: [
          { to: "/accounting?tab=fixed_assets", label: "Fixed Assets", icon: Boxes },
          { to: "/accounting?tab=asset_categories", label: "Asset Categories", icon: FolderTree },
          { to: "/accounting?tab=depreciation", label: "Depreciation", icon: TrendingUp },
          { to: "/accounting?tab=asset_register", label: "Asset Register", icon: FileCheck },
        ]
      },
      {
        to: "/accounting?tab=budgets",
        label: "Budgeting",
        icon: LineChart,
        subItems: [
          { to: "/accounting?tab=budgets", label: "Budgets", icon: PieChart },
          { to: "/accounting?tab=forecasts", label: "Forecasts", icon: TrendingUp },
          { to: "/accounting?tab=cost_allocation", label: "Cost Allocation", icon: Calculator },
          { to: "/accounting?tab=financial_planning", label: "Financial Planning", icon: LineChart },
        ]
      },
      {
        to: "/accounting?tab=expense_claims",
        label: "Expenses",
        icon: CreditCard,
        subItems: [
          { to: "/accounting?tab=expense_claims", label: "Expense Claims", icon: CreditCard },
          { to: "/accounting?tab=approvals", label: "Approvals", icon: ShieldCheck },
          { to: "/accounting?tab=travel", label: "Travel", icon: MapPin },
          { to: "/accounting?tab=office_expenses", label: "Office Expenses", icon: Building2 },
          { to: "/accounting?tab=operational_expenses", label: "Operational Expenses", icon: Activity },
        ]
      },
      {
        to: "/accounting?tab=profit_and_loss",
        label: "Financial Statements",
        icon: FileCheck,
        subItems: [
          { to: "/accounting?tab=profit_and_loss", label: "Profit & Loss", icon: FileCheck },
          { to: "/accounting?tab=balance_sheet", label: "Balance Sheet", icon: FileCheck },
          { to: "/accounting?tab=trial_balance", label: "Trial Balance", icon: FileCheck },
          { to: "/accounting?tab=cash_flow_statement", label: "Cash Flow", icon: FileCheck },
          { to: "/accounting?tab=gl_statement", label: "General Ledger", icon: FileCheck },
        ]
      },
      {
        to: "/accounting?tab=revenue_analytics",
        label: "Financial Intelligence",
        icon: BrainCircuit,
        subItems: [
          { to: "/accounting?tab=revenue_analytics", label: "Revenue Analytics", icon: LineChart },
          { to: "/accounting?tab=expense_analytics", label: "Expense Analytics", icon: PieChart },
          { to: "/accounting?tab=profit_forecast", label: "Profit Forecast", icon: TrendingUp },
          { to: "/accounting?tab=cash_forecast", label: "Cash Forecast", icon: TrendingUp },
          { to: "/accounting?tab=ai_financial_insights", label: "AI Financial Insights", icon: Sparkles },
        ]
      },
    ]
  },
  {
    group: "HRMS", permission: "view:hrms", items: [
      {
        to: "/hrms?tab=employees",
        label: "Employee Management",
        icon: Users,
        subItems: [
          { to: "/hrms?tab=employees", label: "Employees", icon: Users },
          { to: "/hrms?tab=departments", label: "Departments", icon: Briefcase },
          { to: "/hrms?tab=designations", label: "Designations", icon: Target },
          { to: "/hrms?tab=teams", label: "Teams", icon: Users },
          { to: "/hrms?tab=documents", label: "Documents", icon: FileCheck },
          { to: "/hrms?tab=employee_profile", label: "Employee Profile", icon: UserCog },
        ]
      },
      {
        to: "/hrms?tab=daily_attendance",
        label: "Attendance",
        icon: Clock,
        subItems: [
          { to: "/hrms?tab=daily_attendance", label: "Daily Attendance", icon: Clock },
          { to: "/hrms?tab=biometric", label: "Biometric", icon: Radio },
          { to: "/hrms?tab=face_recognition", label: "Face Recognition", icon: ScanBarcode },
          { to: "/hrms?tab=gps_attendance", label: "GPS Attendance", icon: MapPin },
          { to: "/hrms?tab=shift_attendance", label: "Shift Attendance", icon: Clock },
          { to: "/hrms?tab=attendance_corrections", label: "Attendance Corrections", icon: FileCheck },
        ]
      },
      {
        to: "/hrms?tab=leave_requests",
        label: "Leave",
        icon: Calendar,
        subItems: [
          { to: "/hrms?tab=leave_requests", label: "Leave Requests", icon: Calendar },
          { to: "/hrms?tab=leave_calendar", label: "Leave Calendar", icon: CalendarClock },
          { to: "/hrms?tab=leave_balance", label: "Leave Balance", icon: Calculator },
          { to: "/hrms?tab=approvals", label: "Approvals", icon: ShieldCheck },
        ]
      },
      {
        to: "/hrms?tab=salary_structure",
        label: "Payroll",
        icon: CreditCard,
        subItems: [
          { to: "/hrms?tab=salary_structure", label: "Salary Structure", icon: Calculator },
          { to: "/hrms?tab=payroll_processing", label: "Payroll Processing", icon: Clock },
          { to: "/hrms?tab=pf", label: "PF", icon: FileCheck },
          { to: "/hrms?tab=esi", label: "ESI", icon: FileCheck },
          { to: "/hrms?tab=tds", label: "TDS", icon: FileCheck },
          { to: "/hrms?tab=payslips", label: "Payslips", icon: FileCheck },
          { to: "/hrms?tab=loans", label: "Loans", icon: CreditCard },
          { to: "/hrms?tab=advances", label: "Advances", icon: CreditCard },
          { to: "/hrms?tab=bonuses", label: "Bonuses", icon: Target },
          { to: "/hrms?tab=commissions", label: "Commissions", icon: Calculator },
        ]
      },
      {
        to: "/hrms?tab=job_openings",
        label: "Recruitment",
        icon: Briefcase,
        subItems: [
          { to: "/hrms?tab=job_openings", label: "Job Openings", icon: Briefcase },
          { to: "/hrms?tab=applicants", label: "Applicants", icon: Users },
          { to: "/hrms?tab=interviews", label: "Interviews", icon: Clock },
          { to: "/hrms?tab=offer_letters", label: "Offer Letters", icon: FileCheck },
          { to: "/hrms?tab=onboarding", label: "Onboarding", icon: Target },
        ]
      },
      {
        to: "/hrms?tab=goals",
        label: "Performance",
        icon: Target,
        subItems: [
          { to: "/hrms?tab=goals", label: "Goals", icon: Target },
          { to: "/hrms?tab=kpis", label: "KPIs", icon: BarChart3 },
          { to: "/hrms?tab=appraisals", label: "Appraisals", icon: Activity },
          { to: "/hrms?tab=performance_reviews", label: "Performance Reviews", icon: FileCheck },
          { to: "/hrms?tab=incentives", label: "Incentives", icon: CreditCard },
        ]
      },
      {
        to: "/hrms?tab=training",
        label: "Learning",
        icon: BrainCircuit,
        subItems: [
          { to: "/hrms?tab=training", label: "Training", icon: Target },
          { to: "/hrms?tab=courses", label: "Courses", icon: FileCheck },
          { to: "/hrms?tab=certificates", label: "Certificates", icon: ShieldCheck },
          { to: "/hrms?tab=assessments", label: "Assessments", icon: FileCheck },
        ]
      },
      {
        to: "/hrms?tab=ess_attendance",
        label: "Employee Self Service",
        icon: UserCog,
        subItems: [
          { to: "/hrms?tab=ess_attendance", label: "Attendance", icon: Clock },
          { to: "/hrms?tab=ess_leaves", label: "Leaves", icon: Calendar },
          { to: "/hrms?tab=ess_payroll", label: "Payroll", icon: CreditCard },
          { to: "/hrms?tab=ess_documents", label: "Documents", icon: FileCheck },
          { to: "/hrms?tab=ess_tasks", label: "Tasks", icon: Target },
          { to: "/hrms?tab=ess_announcements", label: "Announcements", icon: Radio },
        ]
      },
      {
        to: "/hrms?tab=resignation",
        label: "Exit Management",
        icon: ArrowRightLeft,
        subItems: [
          { to: "/hrms?tab=resignation", label: "Resignation", icon: FileCheck },
          { to: "/hrms?tab=clearance", label: "Clearance", icon: ShieldCheck },
          { to: "/hrms?tab=final_settlement", label: "Final Settlement", icon: Calculator },
          { to: "/hrms?tab=experience_letter", label: "Experience Letter", icon: FileCheck },
        ]
      },
      {
        to: "/hrms?tab=attendance_analytics",
        label: "HR Intelligence",
        icon: BrainCircuit,
        subItems: [
          { to: "/hrms?tab=attendance_analytics", label: "Attendance Analytics", icon: PieChart },
          { to: "/hrms?tab=payroll_analytics", label: "Payroll Analytics", icon: LineChart },
          { to: "/hrms?tab=attrition_prediction", label: "Attrition Prediction", icon: Skull },
          { to: "/hrms?tab=shift_optimization", label: "Shift Optimization", icon: TrendingUp },
          { to: "/hrms?tab=productivity_score", label: "Productivity Score", icon: Activity },
          { to: "/hrms?tab=training_recommendation", label: "Training Recommendation", icon: Sparkles },
        ]
      },
    ]
  },
  {
    group: "IoT", permission: "view:iot", items: [
      {
        to: "/iot?tab=connected_devices",
        label: "Devices",
        icon: Radio,
        subItems: [
          { to: "/iot?tab=connected_devices", label: "Connected Devices", icon: Radio },
          { to: "/iot?tab=biometric_devices", label: "Biometric Devices", icon: ScanBarcode },
          { to: "/iot?tab=barcode_scanners", label: "Barcode Scanners", icon: Barcode },
          { to: "/iot?tab=rfid_readers", label: "RFID Readers", icon: Radio },
          { to: "/iot?tab=face_recognition", label: "Face Recognition", icon: ScanBarcode },
          { to: "/iot?tab=gps_devices", label: "GPS Devices", icon: MapPin },
          { to: "/iot?tab=sensors", label: "Sensors", icon: Activity },
        ]
      },
      {
        to: "/iot?tab=device_status",
        label: "Monitoring",
        icon: Activity,
        subItems: [
          { to: "/iot?tab=device_status", label: "Device Status", icon: Activity },
          { to: "/iot?tab=health", label: "Health", icon: Activity },
          { to: "/iot?tab=alerts", label: "Alerts", icon: AlertTriangle },
          { to: "/iot?tab=device_logs", label: "Device Logs", icon: History },
          { to: "/iot?tab=firmware", label: "Firmware", icon: Settings },
          { to: "/iot?tab=connectivity", label: "Connectivity", icon: Network },
        ]
      },
      {
        to: "/iot?tab=smart_shelves",
        label: "Smart Infrastructure",
        icon: Building2,
        subItems: [
          { to: "/iot?tab=smart_shelves", label: "Smart Shelves", icon: Boxes },
          { to: "/iot?tab=temperature_sensors", label: "Temperature Sensors", icon: Activity },
          { to: "/iot?tab=weight_scales", label: "Weight Scales", icon: Scale },
          { to: "/iot?tab=smart_gates", label: "Smart Gates", icon: ShieldCheck },
          { to: "/iot?tab=cctv_analytics", label: "CCTV Analytics", icon: Target },
        ]
      },
      {
        to: "/iot?tab=employee_tracking",
        label: "Tracking",
        icon: MapPin,
        subItems: [
          { to: "/iot?tab=employee_tracking", label: "Employee Tracking", icon: Users },
          { to: "/iot?tab=asset_tracking", label: "Asset Tracking", icon: Boxes },
          { to: "/iot?tab=vehicle_tracking", label: "Vehicle Tracking", icon: Truck },
          { to: "/iot?tab=warehouse_tracking", label: "Warehouse Tracking", icon: Warehouse },
        ]
      },
      {
        to: "/iot?tab=device_usage",
        label: "IoT Analytics",
        icon: BrainCircuit,
        subItems: [
          { to: "/iot?tab=device_usage", label: "Device Usage", icon: PieChart },
          { to: "/iot?tab=device_health", label: "Device Health", icon: LineChart },
          { to: "/iot?tab=heatmaps", label: "Heatmaps", icon: MapPin },
          { to: "/iot?tab=movement_analytics", label: "Movement Analytics", icon: Activity },
          { to: "/iot?tab=analytics_alerts", label: "Alerts", icon: AlertTriangle },
        ]
      },
    ]
  },
  {
    group: "Analytics & Intelligence", permission: "view:reports", items: [
      {
        to: "/reports?tab=sales_reports",
        label: "Sales",
        icon: TrendingUp,
        subItems: [
          { to: "/reports?tab=sales_reports", label: "Sales Reports", icon: TrendingUp },
          { to: "/reports?tab=revenue_reports", label: "Revenue Reports", icon: LineChart },
          { to: "/reports?tab=branch_reports", label: "Branch Reports", icon: Building2 },
          { to: "/reports?tab=pos_reports", label: "POS Reports", icon: ShoppingCart },
        ]
      },
      {
        to: "/reports?tab=stock_reports",
        label: "Inventory",
        icon: Boxes,
        subItems: [
          { to: "/reports?tab=stock_reports", label: "Stock Reports", icon: Boxes },
          { to: "/reports?tab=movement_reports", label: "Movement Reports", icon: ArrowRightLeft },
          { to: "/reports?tab=warehouse_reports", label: "Warehouse Reports", icon: Warehouse },
          { to: "/reports?tab=abc_analysis_reports", label: "ABC Analysis", icon: PieChart },
          { to: "/reports?tab=xyz_analysis_reports", label: "XYZ Analysis", icon: LineChart },
        ]
      },
      {
        to: "/reports?tab=purchase_reports",
        label: "Procurement",
        icon: ShoppingBag,
        subItems: [
          { to: "/reports?tab=purchase_reports", label: "Purchase Reports", icon: ShoppingBag },
          { to: "/reports?tab=supplier_reports", label: "Supplier Reports", icon: Truck },
          { to: "/reports?tab=grn_reports", label: "GRN Reports", icon: FileCheck },
          { to: "/reports?tab=spend_analysis_reports", label: "Spend Analysis", icon: Calculator },
        ]
      },
      {
        to: "/reports?tab=customer_reports",
        label: "CRM",
        icon: Users,
        subItems: [
          { to: "/reports?tab=customer_reports", label: "Customer Reports", icon: Users },
          { to: "/reports?tab=lead_reports", label: "Lead Reports", icon: UserCog },
          { to: "/reports?tab=loyalty_reports", label: "Loyalty Reports", icon: Tags },
          { to: "/reports?tab=campaign_reports", label: "Campaign Reports", icon: Radio },
        ]
      },
      {
        to: "/reports?tab=vendor_reports",
        label: "Marketplace",
        icon: Store,
        subItems: [
          { to: "/reports?tab=vendor_reports", label: "Vendor Reports", icon: Store },
          { to: "/reports?tab=marketplace_revenue", label: "Marketplace Revenue", icon: LineChart },
          { to: "/reports?tab=delivery_reports", label: "Delivery Reports", icon: Truck },
          { to: "/reports?tab=order_reports", label: "Order Reports", icon: ShoppingCart },
        ]
      },
      {
        to: "/reports?tab=attendance_reports",
        label: "HR",
        icon: UserCog,
        subItems: [
          { to: "/reports?tab=attendance_reports", label: "Attendance Reports", icon: Clock },
          { to: "/reports?tab=payroll_reports", label: "Payroll Reports", icon: CreditCard },
          { to: "/reports?tab=recruitment_reports", label: "Recruitment Reports", icon: Briefcase },
          { to: "/reports?tab=performance_reports", label: "Performance Reports", icon: Target },
        ]
      },
      {
        to: "/reports?tab=pnl_reports",
        label: "Finance",
        icon: Calculator,
        subItems: [
          { to: "/reports?tab=pnl_reports", label: "P&L", icon: FileCheck },
          { to: "/reports?tab=balance_sheet_reports", label: "Balance Sheet", icon: FileCheck },
          { to: "/reports?tab=cash_flow_reports", label: "Cash Flow", icon: FileCheck },
          { to: "/reports?tab=gst_reports", label: "GST Reports", icon: FileCheck },
          { to: "/reports?tab=expense_reports", label: "Expense Reports", icon: CreditCard },
        ]
      },
      {
        to: "/reports?tab=revenue_prediction",
        label: "AI Analytics",
        icon: BrainCircuit,
        subItems: [
          { to: "/reports?tab=revenue_prediction", label: "Revenue Prediction", icon: TrendingUp },
          { to: "/reports?tab=demand_forecast_reports", label: "Demand Forecast", icon: TrendingUp },
          { to: "/reports?tab=inventory_forecast", label: "Inventory Forecast", icon: Boxes },
          { to: "/reports?tab=customer_prediction", label: "Customer Prediction", icon: Users },
          { to: "/reports?tab=attrition_prediction_reports", label: "Attrition Prediction", icon: Skull },
          { to: "/reports?tab=fraud_detection_reports", label: "Fraud Detection", icon: ShieldCheck },
        ]
      },
      {
        to: "/reports?tab=custom_reports",
        label: "Report Builder",
        icon: Settings,
        subItems: [
          { to: "/reports?tab=custom_reports", label: "Custom Reports", icon: Settings },
          { to: "/reports?tab=saved_reports", label: "Saved Reports", icon: FileCheck },
          { to: "/reports?tab=scheduled_reports", label: "Scheduled Reports", icon: Clock },
          { to: "/reports?tab=exports", label: "Exports", icon: FileCheck },
        ]
      },
    ]
  },
  {
    group: "System Configuration", permission: "view:settings", items: [
      {
        to: "/settings?tab=company_profile",
        label: "Company",
        icon: Building2,
        subItems: [
          { to: "/settings?tab=company_profile", label: "Company Profile", icon: Building2 },
          { to: "/settings?tab=branch_settings", label: "Branch Settings", icon: MapPin },
          { to: "/settings?tab=branding", label: "Branding", icon: Image },
        ]
      },
      {
        to: "/settings?tab=user_preferences",
        label: "Users",
        icon: Users,
        subItems: [
          { to: "/settings?tab=user_preferences", label: "User Preferences", icon: Settings },
          { to: "/settings?tab=notifications", label: "Notifications", icon: Radio },
          { to: "/settings?tab=language", label: "Language", icon: Settings },
          { to: "/settings?tab=timezone", label: "Timezone", icon: Clock },
        ]
      },
      {
        to: "/settings?tab=payment_gateways",
        label: "Integrations",
        icon: Network,
        subItems: [
          { to: "/settings?tab=payment_gateways", label: "Payment Gateways", icon: CreditCard },
          { to: "/settings?tab=whatsapp_integration", label: "WhatsApp", icon: Network },
          { to: "/settings?tab=sms_integration", label: "SMS", icon: Radio },
          { to: "/settings?tab=email_integration", label: "Email", icon: Inbox },
          { to: "/settings?tab=google_integration", label: "Google", icon: Network },
          { to: "/settings?tab=microsoft_integration", label: "Microsoft", icon: Network },
          { to: "/settings?tab=webhooks", label: "Webhooks", icon: Network },
          { to: "/settings?tab=api_connections", label: "API Connections", icon: Network },
        ]
      },
      {
        to: "/settings?tab=antigravity_settings",
        label: "AI",
        icon: Sparkles,
        subItems: [
          { to: "/settings?tab=antigravity_settings", label: "Antigravity Settings", icon: Settings },
          { to: "/settings?tab=ai_models", label: "AI Models", icon: BrainCircuit },
          { to: "/settings?tab=ai_credits", label: "AI Credits", icon: CreditCard },
          { to: "/settings?tab=ai_permissions", label: "AI Permissions", icon: ShieldCheck },
          { to: "/settings?tab=prompt_templates", label: "Prompt Templates", icon: FileCheck },
        ]
      },
      {
        to: "/settings?tab=email_templates",
        label: "Notifications",
        icon: Radio,
        subItems: [
          { to: "/settings?tab=email_templates", label: "Email Templates", icon: FileCheck },
          { to: "/settings?tab=sms_templates", label: "SMS Templates", icon: FileCheck },
          { to: "/settings?tab=whatsapp_templates", label: "WhatsApp Templates", icon: FileCheck },
          { to: "/settings?tab=push_notifications_settings", label: "Push Notifications", icon: Radio },
        ]
      },
      {
        to: "/settings?tab=password_policies",
        label: "Security",
        icon: ShieldCheck,
        subItems: [
          { to: "/settings?tab=password_policies", label: "Password Policies", icon: ShieldCheck },
          { to: "/settings?tab=mfa", label: "MFA", icon: ShieldCheck },
          { to: "/settings?tab=session_policies", label: "Session Policies", icon: ShieldCheck },
          { to: "/settings?tab=device_policies", label: "Device Policies", icon: ShieldCheck },
          { to: "/settings?tab=login_history", label: "Login History", icon: History },
        ]
      },
      {
        to: "/settings?tab=themes",
        label: "Appearance",
        icon: Image,
        subItems: [
          { to: "/settings?tab=themes", label: "Themes", icon: Image },
          { to: "/settings?tab=dark_mode", label: "Dark Mode", icon: Image },
          { to: "/settings?tab=accent_colors", label: "Accent Colors", icon: Image },
          { to: "/settings?tab=logo", label: "Logo", icon: Image },
          { to: "/settings?tab=brand_assets", label: "Brand Assets", icon: Image },
        ]
      },
      {
        to: "/settings?tab=backup",
        label: "Backup",
        icon: History,
        subItems: [
          { to: "/settings?tab=backup", label: "Backup", icon: History },
          { to: "/settings?tab=restore", label: "Restore", icon: History },
          { to: "/settings?tab=import", label: "Import", icon: ArrowDownToLine },
          { to: "/settings?tab=export", label: "Export", icon: FileCheck },
        ]
      },
      {
        to: "/settings?tab=subscription",
        label: "Licenses",
        icon: ShieldCheck,
        subItems: [
          { to: "/settings?tab=subscription", label: "Subscription", icon: ShieldCheck },
          { to: "/settings?tab=storage", label: "Storage", icon: Database },
          { to: "/settings?tab=ai_credits_usage", label: "AI Credits", icon: CreditCard },
          { to: "/settings?tab=modules", label: "Modules", icon: Network },
          { to: "/settings?tab=usage", label: "Usage", icon: Activity },
        ]
      },
    ]
  }
];

export const GROUP_COLORS: Record<string, { text: string; gradient: string; glow: string }> = {
  "Workspace": { text: "text-blue-600 dark:text-blue-400", gradient: "bg-gradient-to-r from-blue-500 to-indigo-500", glow: "shadow-blue-500/25" },
  "Core ERP": { text: "text-indigo-600 dark:text-indigo-400", gradient: "bg-gradient-to-r from-indigo-500 to-purple-600", glow: "shadow-indigo-500/25" },
  "Inventory & Warehouse": { text: "text-emerald-600 dark:text-emerald-400", gradient: "bg-gradient-to-r from-emerald-500 to-teal-500", glow: "shadow-emerald-500/25" },
  "Operations": { text: "text-cyan-600 dark:text-cyan-400", gradient: "bg-gradient-to-r from-cyan-500 to-sky-500", glow: "shadow-cyan-500/25" },
  "Sales & CRM": { text: "text-rose-600 dark:text-rose-400", gradient: "bg-gradient-to-r from-rose-500 to-pink-600", glow: "shadow-rose-500/25" },
  "Marketplace": { text: "text-amber-600 dark:text-amber-400", gradient: "bg-gradient-to-r from-amber-500 to-orange-500", glow: "shadow-amber-500/25" },
  "Accounting & Finance": { text: "text-violet-600 dark:text-violet-400", gradient: "bg-gradient-to-r from-violet-500 to-fuchsia-600", glow: "shadow-violet-500/25" },
  "HRMS": { text: "text-pink-600 dark:text-pink-400", gradient: "bg-gradient-to-r from-pink-500 to-rose-500", glow: "shadow-pink-500/25" },
  "IoT": { text: "text-teal-600 dark:text-teal-400", gradient: "bg-gradient-to-r from-teal-500 to-cyan-600", glow: "shadow-teal-500/25" },
  "Analytics & Intelligence": { text: "text-fuchsia-600 dark:text-fuchsia-400", gradient: "bg-gradient-to-r from-fuchsia-500 to-purple-600", glow: "shadow-fuchsia-500/25" },
  "System Configuration": { text: "text-slate-600 dark:text-slate-400", gradient: "bg-gradient-to-r from-slate-500 to-gray-600", glow: "shadow-slate-500/20" },
};
