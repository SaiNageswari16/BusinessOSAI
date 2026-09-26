import React from 'react';
import { InventoryReportsSuite, InventoryReportType } from '../InventoryReportsSuite';

export function StockReports({ defaultReport = "stock_summary" }: { defaultReport?: InventoryReportType }) {
  return <InventoryReportsSuite defaultReport={defaultReport} />;
}
