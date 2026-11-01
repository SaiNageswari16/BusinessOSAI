import { request } from "./api-client";

export interface DashboardKPI {
  label: string;
  value: string | number;
  change: number;
  hint: string;
  tone: "blue" | "purple" | "amber" | "cyan" | "green";
  isCurrency?: boolean;
}

export interface DashboardData {
  kpis: DashboardKPI[];
  totalSales?: number;
  todaysSalesCount?: number;
  ordersPending?: number;
  activeCustomers?: number;
  employeesPresent?: number;
  totalEmployees?: number;
  employeesAbsent?: number;
  inventoryValue?: number;
  pendingDeliveries?: number;
  pendingPayments?: number;
  posRevenueToday?: number;
  posTransactionsToday?: number;
  lifetimeRevenue?: number;
  lifetimeSalesCount?: number;
}

export interface DashboardChartsData {
  revenueData: any[];
  channelData: any[];
  ordersTrend: any[];
}

export interface DashboardWidgetsData {
  operationsWidgets: any[];
  branchPerformance: any[];
  inventoryAlerts: any[];
  recentActivity: any[];
  notifications: any[];
  calendarEvents: any[];
}

export const workspaceApi = {
  getCurrentWorkspace: async (): Promise<{ name: string; id: string }> => {
    return { id: "W-1", name: "Store HQ" };
  },
  getDashboardKPIs: async (): Promise<DashboardData> => {
    return request<DashboardData>("GET", "/workspace/dashboard/kpis");
  },
  getDashboardCharts: async (): Promise<DashboardChartsData> => {
    return request<DashboardChartsData>("GET", "/workspace/dashboard/charts");
  },
  getDashboardWidgets: async (): Promise<DashboardWidgetsData> => {
    return request<DashboardWidgetsData>("GET", "/workspace/dashboard/widgets");
  },
  getDashboardFeeds: async (): Promise<Record<string, any[]>> => {
    return request<Record<string, any[]>>("GET", "/workspace/dashboard/feeds");
  }
};
