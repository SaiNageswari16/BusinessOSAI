import React from 'react';
import { InventoryReportsSuite } from '../InventoryReportsSuite';

export function WarehouseReports() {
  return <InventoryReportsSuite defaultReport="stock_godown" />;
}
