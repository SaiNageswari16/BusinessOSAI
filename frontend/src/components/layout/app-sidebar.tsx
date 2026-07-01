import { Link, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Sparkles, Boxes, Warehouse, ShoppingCart, ShoppingBag,
  Users, Store, Calculator, UserCog, Radio, BarChart3, Settings,
  ChevronLeft, ChevronRight, Building2, Truck, ShieldCheck, MapPin,
  Briefcase, Target, Network, CreditCard, Calendar, Laptop, History, Activity, Clock, FileCheck,
  Package, FolderTree, Layers, Tags, Scale, SlidersHorizontal, Combine, PackagePlus, Blocks, Image, ArrowRightLeft, Sliders, RotateCw, RefreshCw, ClipboardCheck, Grid, Columns, Inbox, ArrowDownToLine, ListChecks, Hash, Barcode, CalendarX, CalendarClock, ScanBarcode, QrCode, AlertTriangle, TrendingUp, Snail, Rocket, Skull, PieChart, LineChart, BrainCircuit, Database
} from "lucide-react";
import { useState } from "react";
import { useRbac } from "@/contexts/rbac-context";
import { cn } from "@/lib/utils";

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

const nav: NavGroup[] = [
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
      {
        to: "/pos?tab=terminal",
        label: "POS Operations",
        icon: ShoppingCart,
        permission: "view:pos",
        subItems: [
          { to: "/pos?tab=terminal", label: "POS Terminal", icon: ShoppingCart },
          { to: "/pos?tab=shift_management", label: "Shift Management", icon: Clock },
          { to: "/pos?tab=sales_history", label: "Sales History", icon: History },
          { to: "/pos?tab=returns_refunds", label: "Returns & Refunds", icon: ArrowRightLeft },
        ]
      },
      {
        to: "/pos?tab=customers",
        label: "Customer & Loyalty",
        icon: Users,
        subItems: [
          { to: "/pos?tab=customers", label: "Customers", icon: Users },
          { to: "/pos?tab=loyalty_programs", label: "Loyalty Programs", icon: Tags },
        ]
      },
      {
        to: "/pos?tab=store_settings",
        label: "Store Settings",
        icon: Settings,
        subItems: [
          { to: "/pos?tab=store_settings", label: "Store Settings", icon: Settings },
          { to: "/pos?tab=payment_methods", label: "Payment Methods", icon: CreditCard },
          { to: "/pos?tab=receipt_templates", label: "Receipt Templates", icon: FileCheck },
        ]
      },
    ]
  },
  {
    group: "Sales & CRM", permission: "view:crm", items: [
      {
        to: "/crm?tab=dashboard",
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
        to: "/crm?tab=leads",
        label: "Sales CRM",
        icon: TrendingUp,
        subItems: [
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
          { to: "/marketplace?tab=vendor_dashboard", label: "Vendor Dashboard", icon: LayoutDashboard },
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
        to: "/accounting?tab=dashboard",
        label: "Finance Dashboard",
        icon: LayoutDashboard,
        subItems: [
          { to: "/accounting?tab=overview", label: "Overview", icon: LayoutDashboard },
          { to: "/accounting?tab=cash_flow", label: "Cash Flow", icon: LineChart },
          { to: "/accounting?tab=revenue", label: "Revenue", icon: TrendingUp },
          { to: "/accounting?tab=expenses", label: "Expenses", icon: TrendingUp },
          { to: "/accounting?tab=profit", label: "Profit", icon: PieChart },
        ]
      },
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
        to: "/reports?tab=executive_dashboard",
        label: "Executive",
        icon: LayoutDashboard,
        subItems: [
          { to: "/reports?tab=executive_dashboard", label: "Executive Dashboard", icon: LayoutDashboard },
          { to: "/reports?tab=ceo_dashboard", label: "CEO Dashboard", icon: Briefcase },
          { to: "/reports?tab=business_health", label: "Business Health", icon: Activity },
        ]
      },
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

export function AppSidebar() {
  const router = useRouterState();
  const currentPath = router.location.pathname;
  const currentSearch = router.location.searchStr;
  const currentUrl = currentPath + currentSearch;

  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState(false);

  const { hasPermission } = useRbac();

  // Filter navigation items based on active role permissions
  const authorizedNav = nav
    .filter(group => !group.permission || hasPermission(group.permission))
    .map(group => {
      const authorizedItems = group.items
        .filter(item => !item.permission || hasPermission(item.permission))
        .map(item => {
          if (!item.subItems) return item;
          const authorizedSubItems = item.subItems.filter(sub => !sub.permission || hasPermission(sub.permission));
          return { ...item, subItems: authorizedSubItems };
        })
        .filter(item => !item.subItems || item.subItems.length > 0);
      return { ...group, items: authorizedItems };
    })
    .filter(group => group.items.length > 0);

  const toggleItem = (label: string, e: React.MouseEvent) => {
    setExpandedItems(prev => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 280 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="hidden md:flex flex-col bg-sidebar border-r border-sidebar-border shrink-0 h-screen sticky top-0 z-30"
    >
      <div className="h-16 flex items-center gap-3 px-4 border-b border-sidebar-border">
        <div className="size-9 shrink-0 rounded-xl gradient-brand grid place-items-center text-white shadow-elegant">
          <Sparkles className="size-5" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="font-bold tracking-tight text-sidebar-foreground">BusinessOS AI</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">AI Edition</div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6 scrollbar-thin">
        {authorizedNav.map((g) => (
          <div key={g.group}>
            {!collapsed && (
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-2">
                {g.group}
              </div>
            )}
            <div className="space-y-1">
              {g.items.map((item) => {
                const isItemActive = currentPath === item.to;
                const hasActiveSubItem = item.subItems?.some((sub: any) => currentPath === sub.to);

                // An item is expanded if it's explicitly toggled, OR if it has an active subitem 
                // and it hasn't been explicitly collapsed. We initialize the default state to true if active.
                const isExplicitlyExpanded = expandedItems[item.label];
                const isGroupExpanded = isExplicitlyExpanded !== undefined
                  ? isExplicitlyExpanded
                  : (isItemActive || hasActiveSubItem ||
                    (currentPath.startsWith('/erp') && item.label === 'Core ERP') ||
                    (currentPath.startsWith('/inventory') && ['Product Master', 'Inventory Operations', 'Warehouse Management', 'Batch & Traceability', 'Inventory Intelligence'].includes(item.label)) ||
                    (currentPath.startsWith('/procurement') && ['Supplier Management', 'Procurement', 'Vendor Payments', 'Procurement Intelligence'].includes(item.label)) ||
                    (currentPath.startsWith('/pos') && ['POS Operations', 'Customer & Loyalty', 'Store Settings'].includes(item.label)) ||
                    (currentPath.startsWith('/crm') && ['Customer Management', 'Sales CRM', 'Customer Service', 'Communication', 'Customer Intelligence'].includes(item.label)) ||
                    (currentPath.startsWith('/marketplace') && g.group === 'Marketplace') ||
                    (currentPath.startsWith('/accounting') && g.group === 'Accounting & Finance') ||
                    (currentPath.startsWith('/hrms') && g.group === 'HRMS') ||
                    (currentPath.startsWith('/iot') && g.group === 'IoT') ||
                    (currentPath.startsWith('/reports') && g.group === 'Reports') ||
                    (currentPath.startsWith('/settings') && g.group === 'Settings'));

                return (
                  <div key={item.to} className="space-y-1">
                    <Link
                      to={item.to}
                      onClick={(e) => {
                        if (item.subItems) {
                          toggleItem(item.label, e);
                        }
                      }}
                      className={cn(
                        "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all relative",
                        (isItemActive || hasActiveSubItem) && !item.subItems
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : isGroupExpanded && item.subItems
                            ? "bg-primary/5 text-primary"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                      )}
                    >
                      {((isItemActive || hasActiveSubItem) && !item.subItems) && (
                        <motion.div layoutId="active-pill" className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-primary" />
                      )}
                      <item.icon className={cn("size-4.5 shrink-0", (isItemActive || hasActiveSubItem) && "text-primary")} />
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md gradient-brand text-white">
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </Link>

                    {!collapsed && item.subItems && isGroupExpanded && (
                      <div className="pl-9 pr-2 py-1 space-y-1 relative">
                        <div className="absolute left-5.25 top-0 bottom-3 w-px bg-sidebar-border" />

                        {item.subItems.map((subItem: any) => {
                          const isSubActive = currentPath === subItem.to ||
                            (currentPath === '/erp' && subItem.to === '/erp?tab=companies') ||
                            (currentPath === '/inventory' && subItem.to === '/inventory?tab=products') ||
                            (currentPath === '/procurement' && subItem.to === '/procurement?tab=suppliers') ||
                            (currentPath === '/pos' && subItem.to === '/pos?tab=terminal') ||
                            (currentPath === '/crm' && subItem.to === '/crm?tab=customers') ||
                            (currentPath === '/marketplace' && subItem.to === '/marketplace?tab=vendors') ||
                            (currentPath === '/accounting' && subItem.to === '/accounting?tab=overview') ||
                            (currentPath === '/hrms' && subItem.to === '/hrms?tab=employees') ||
                            (currentPath === '/iot' && subItem.to === '/iot?tab=connected_devices') ||
                            (currentPath === '/reports' && subItem.to === '/reports?tab=executive_dashboard') ||
                            (currentPath === '/settings' && subItem.to === '/settings?tab=company_profile');

                          return (
                            <Link
                              key={subItem.to}
                              to={subItem.to}
                              className={cn(
                                "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors relative",
                                isSubActive
                                  ? "bg-primary/10 text-primary font-semibold"
                                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                              )}
                            >
                              <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-3 h-px bg-sidebar-border" />

                              <subItem.icon className={cn("size-3.5", isSubActive && "text-primary")} />
                              <span className="truncate">{subItem.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-sidebar-accent transition"
        >
          {collapsed ? <ChevronRight className="size-4" /> : <><ChevronLeft className="size-4" /> Collapse</>}
        </button>
      </div>
    </motion.aside>
  );
}
