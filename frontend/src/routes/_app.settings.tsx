import React from "react";
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useRbac } from "@/contexts/rbac-context";
import { Unauthorized } from "@/components/unauthorized";
import { MockScreen } from "@/components/mock-screen";
import { RecruitmentIntegrations } from "@/components/recruitment-integrations";
import { NotificationSettings } from "@/components/NotificationSettings";
import { EmailCampaigns } from "@/components/crm/EmailCampaigns";
import { PushNotifications } from "@/components/crm/PushNotifications";

// ERP & Enterprise System Settings Components
import { CompanyProfile } from "@/components/erp/CompanyProfile";
import { BranchManagement } from "@/components/erp/BranchManagement";
import { UserManagement } from "@/components/erp/UserManagement";
import { RolesPermissions } from "@/components/erp/RolesPermissions";
import { MfaPolicies } from "@/components/erp/MfaPolicies";
import { AuditLogs } from "@/components/erp/AuditLogs";
import { SystemHealth } from "@/components/erp/SystemHealth";
import { GlobalSettings } from "@/components/erp/GlobalSettings";
import { ApiKeys } from "@/components/erp/ApiKeys";
import { NotificationTemplates } from "@/components/erp/NotificationTemplates";
import { DocumentTemplates } from "@/components/erp/DocumentTemplates";
import { CustomFields } from "@/components/erp/CustomFields";
import { AutomationRules } from "@/components/erp/AutomationRules";
import { PasswordPolicies, SessionPolicies, DevicePolicies } from "@/components/erp/SecurityPolicies";
import { BackupRestore } from "@/components/erp/BackupRestore";
import { ErrorLogs } from "@/components/erp/ErrorLogs";
import { ActivityLogs } from "@/components/erp/ActivityLogs";
import { WorkspaceManagement } from "@/components/erp/WorkspaceManagement";
import { SubscriptionManagement } from "@/components/erp/SubscriptionManagement";
import { PermissionMatrix } from "@/components/erp/PermissionMatrix";
import { NumberSeries } from "@/components/erp/NumberSeries";
import { TaxConfiguration } from "@/components/erp/TaxConfiguration";
import { CurrencyManagement } from "@/components/erp/CurrencyManagement";
import { PaymentGateways } from "@/components/erp/PaymentGateways";
import { WhitebooksSettings } from "@/components/settings/WhitebooksSettings";
import { BiometricPasskeySettings } from "@/components/erp/BiometricPasskeySettings";
import { useCurrency } from "@/hooks/use-currency";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsModule,
});

function SystemNotificationsTab() {
  const [subTab, setSubTab] = React.useState<"logs" | "settings">("logs");
  return (
    <div className="space-y-2">
      <div className="px-3 pt-2 flex gap-3 border-b border-border/50 bg-card">
        <button
          onClick={() => setSubTab("logs")}
          className={`px-3 py-2 text-sm font-bold border-b-2 bg-transparent border-none cursor-pointer transition-colors ${
            subTab === "logs" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Live Notifications Log
        </button>
        <button
          onClick={() => setSubTab("settings")}
          className={`px-3 py-2 text-sm font-bold border-b-2 bg-transparent border-none cursor-pointer transition-colors ${
            subTab === "settings" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Alert Settings & Frequencies
        </button>
      </div>
      <div>
        {subTab === "logs" ? <PushNotifications /> : <NotificationSettings />}
      </div>
    </div>
  );
}

const componentMap: Record<string, React.ElementType> = {
  // Company & Branch Management
  company_profile: CompanyProfile,
  branch_settings: BranchManagement,
  branding: GlobalSettings,
  workspaces: WorkspaceManagement,
  subscription: SubscriptionManagement,
  
  // Users, Roles & Security
  user_preferences: UserManagement,
  notifications: SystemNotificationsTab,
  password_policies: PasswordPolicies,
  mfa: MfaPolicies,
  biometrics: BiometricPasskeySettings,
  passkeys: BiometricPasskeySettings,
  session_policies: SessionPolicies,
  device_policies: DevicePolicies,
  login_history: ActivityLogs,
  roles: RolesPermissions,
  permissions: PermissionMatrix,
  audit_logs: AuditLogs,
  
  // Integrations & API Connections
  payment_gateways: PaymentGateways,
  recruitment_integrations: RecruitmentIntegrations,
  whitebooks_settings: WhitebooksSettings,
  gst_integration: WhitebooksSettings,
  ewaybill_integration: WhitebooksSettings,
  einvoice_integration: WhitebooksSettings,
  whatsapp_integration: NotificationTemplates,
  sms_integration: NotificationTemplates,
  email_integration: EmailCampaigns,
  google_integration: GlobalSettings,
  microsoft_integration: GlobalSettings,
  webhooks: AutomationRules,
  api_connections: ApiKeys,
  
  // AI & Systems Configuration
  antigravity_settings: GlobalSettings,
  ai_models: GlobalSettings,
  ai_credits: SubscriptionManagement,
  ai_permissions: PermissionMatrix,
  prompt_templates: DocumentTemplates,
  system_health: SystemHealth,
  backup_restore: BackupRestore,
  error_logs: ErrorLogs,
  custom_fields: CustomFields,
  number_series: NumberSeries,
  tax_configuration: TaxConfiguration,
  
  // Templates & Communication
  email_templates: DocumentTemplates,
  sms_templates: NotificationTemplates,
  whatsapp_templates: NotificationTemplates,
  push_notifications_settings: PushNotifications,
};

function SettingsModule() {
  const { hasPermission } = useRbac();
  const routerState = useRouterState();
  const searchStr = routerState.location.searchStr;
  
  if (!hasPermission("manage:system_admin") && !hasPermission("view:settings")) {
    return <Unauthorized />;
  }

  let activeTab = "company_profile";
  if (searchStr.includes("tab=")) {
    const params = new URLSearchParams(searchStr);
    activeTab = params.get("tab") || "company_profile";
  }

  const formatTitle = (str: string) => str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const ActiveComponent = componentMap[activeTab] || (() => <MockScreen type="settings" title={formatTitle(activeTab)} />);

  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className="flex-1 relative bg-background/50 p-3">
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
