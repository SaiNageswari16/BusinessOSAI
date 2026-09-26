import React from 'react';
import { CustomerPartyReportsSuite, CustomerReportType } from '../CustomerPartyReportsSuite';

export function CustomerReports({ defaultReport = "party_statement" }: { defaultReport?: CustomerReportType }) {
  return <CustomerPartyReportsSuite defaultReport={defaultReport} />;
}
