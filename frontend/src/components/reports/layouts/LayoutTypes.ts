import { LucideIcon } from "lucide-react";

export interface ReportMetric {
  label: string;
  value: string;
  change: string;
  isPositive: boolean;
  icon: string;
}

export interface ReportChartConfig {
  type: "line" | "bar" | "area";
  keys: Array<{
    key: string;
    color: string;
    label: string;
  }>;
}

export interface ReportData {
  title: string;
  metrics: ReportMetric[];
  chartData: any[];
  chartConfig: ReportChartConfig;
  tableColumns: Array<{ header: string; key: string }>;
  tableData: any[];
  aiSummary: string;
}

export interface DashboardLayoutProps {
  reportData: ReportData;
  filteredTableData: any[];
  getKpiIcon: (iconName: string) => LucideIcon;
}
