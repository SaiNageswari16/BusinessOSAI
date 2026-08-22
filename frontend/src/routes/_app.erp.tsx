import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ComingSoon } from "@/components/coming-soon";
import { useRbac } from "@/contexts/rbac-context";
import { Unauthorized } from "@/components/unauthorized";
import { CompanyManagement } from "../components/erp/CompanyManagement";
import { BranchManagement } from "../components/erp/BranchManagement";
import { DepartmentManagement } from "../components/erp/DepartmentManagement";
import { DesignationManagement } from "../components/erp/DesignationManagement";
import { BusinessUnits } from "../components/erp/BusinessUnits";
import { CostCenters } from "../components/erp/CostCenters";
import { FiscalYears } from "../components/erp/FiscalYears";
import { UserManagement } from "../components/erp/UserManagement";
import { RolesPermissions } from "../components/erp/RolesPermissions";
import { SubscriptionManagement } from "../components/erp/SubscriptionManagement";
import { WorkspaceManagement } from "../components/erp/WorkspaceManagement";
import { AuditLogs } from "../components/erp/AuditLogs";
import { ActivityLogs } from "../components/erp/ActivityLogs";
import { OrganizationStructure } from "../components/erp/OrganizationStructure";
import { GlobalSettings } from "../components/erp/GlobalSettings";

// New modules
import { Regions } from "../components/erp/Regions";
import { Zones } from "../components/erp/Zones";
import { Teams } from "../components/erp/Teams";
import { CurrencyManagement } from "../components/erp/CurrencyManagement";
import { TaxConfiguration } from "../components/erp/TaxConfiguration";
import { PaymentTerms } from "../components/erp/PaymentTerms";
import { NumberSeries } from "../components/erp/NumberSeries";
import { PermissionMatrix } from "../components/erp/PermissionMatrix";
import { ApiKeys } from "../components/erp/ApiKeys";
import { MfaPolicies } from "../components/erp/MfaPolicies";
import { ApprovalWorkflows } from "../components/erp/ApprovalWorkflows";
import { NotificationTemplates } from "../components/erp/NotificationTemplates";
import { DocumentTemplates } from "../components/erp/DocumentTemplates";
import { CustomFields } from "../components/erp/CustomFields";
import { AutomationRules } from "../components/erp/AutomationRules";
import { Geography } from "../components/erp/Geography";
import { Locations } from "../components/erp/Locations";
import { CalendarsAndShifts } from "../components/erp/CalendarsAndShifts";
import { TagsLabels } from "../components/erp/TagsLabels";
import { ErrorLogs } from "../components/erp/ErrorLogs";
import { SystemHealth } from "../components/erp/SystemHealth";
import { BackupRestore } from "../components/erp/BackupRestore";
import { GlobalUsers } from "../components/erp/GlobalUsers";

export const Route = createFileRoute("/_app/erp")({
  component: ErpModule,
});

const componentMap: Record<string, React.ElementType> = {
  // Organization
  companies: CompanyManagement,
  business_units: BusinessUnits,
  regions: Regions,
  zones: Zones,
  branches: BranchManagement,
  departments: DepartmentManagement,
  designations: DesignationManagement,
  teams: Teams,
  org_structure: OrganizationStructure,

  // Financial
  fiscal_years: FiscalYears,
  cost_centers: CostCenters,
  currencies: CurrencyManagement,
  taxes: TaxConfiguration,
  payment_terms: PaymentTerms,
  number_series: NumberSeries,

  // Access & Security
  users: UserManagement,
  roles: RolesPermissions,
  permission_matrix: PermissionMatrix,
  workspaces: WorkspaceManagement,
  subscriptions: SubscriptionManagement,
  api_keys: ApiKeys,
  mfa_policies: MfaPolicies,

  // Workflow
  approval_workflows: ApprovalWorkflows,
  notification_templates: NotificationTemplates,
  document_templates: DocumentTemplates,
  custom_fields: CustomFields,
  automation_rules: AutomationRules,

  // Master Data
  geography: Geography,
  locations: Locations,
  calendars_shifts: CalendarsAndShifts,
  tags_labels: TagsLabels,

  // System
  global_users: GlobalUsers,
  audit_logs: AuditLogs,
  activity_logs: ActivityLogs,
  error_logs: ErrorLogs,
  system_health: SystemHealth,
  backup_restore: BackupRestore,
  global_settings: GlobalSettings,
};

const tabPermissions: Record<string, string> = {
  companies: "view:erp",
  business_units: "view:erp",
  regions: "view:geography",
  zones: "view:geography",
  branches: "view:branches",
  departments: "view:departments",
  designations: "view:designations",
  teams: "view:teams",
  org_structure: "view:branches",

  fiscal_years: "view:fiscal_years",
  cost_centers: "view:cost_centers",
  currencies: "view:currencies",
  taxes: "view:taxes",
  payment_terms: "view:payment_terms",
  number_series: "view:number_series",

  users: "view:users",
  roles: "view:roles",
  permission_matrix: "view:permission_matrix",
  workspaces: "view:workspaces",
  subscriptions: "view:subscription",
  api_keys: "view:api_keys",
  mfa_policies: "view:mfa_policies",

  approval_workflows: "view:workflows",
  notification_templates: "view:notification_templates",
  document_templates: "view:document_templates",
  custom_fields: "view:settings",
  automation_rules: "view:workflows",

  geography: "view:geography",
  locations: "view:locations",
  calendars_shifts: "view:erp",
  tags_labels: "view:tags",

  global_users: "manage:system_admin",
  audit_logs: "manage:system_admin",
  activity_logs: "manage:system_admin",
  error_logs: "manage:system_admin",
  system_health: "manage:system_admin",
  backup_restore: "manage:system_admin",
  global_settings: "manage:system_admin",
};


function ErpModule() {
  const routerState = useRouterState();
  const searchStr = routerState.location.searchStr;
  const { hasPermission } = useRbac();

  if (!hasPermission("view:erp")) {
    return <Unauthorized />;
  }

  // Parse search param ?tab=...
  let activeTab = "companies";
  if (searchStr.includes("tab=")) {
    const params = new URLSearchParams(searchStr);
    activeTab = params.get("tab") || "companies";
  }

  const requiredPerm = tabPermissions[activeTab];
  if (requiredPerm && !hasPermission(requiredPerm)) {
    return <Unauthorized />;
  }

  const ActiveComponent = componentMap[activeTab] || CompanyManagement;

  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className="flex-1 relative bg-background/50">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="min-h-full"
          >
            <ActiveComponent />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
