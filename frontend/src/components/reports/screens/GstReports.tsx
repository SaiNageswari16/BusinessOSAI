import React from 'react';
import { GstReportsSuite, GstReportType } from '../GstReportsSuite';

export function GstReports({ defaultReport = "gst_sales" }: { defaultReport?: GstReportType }) {
  return <GstReportsSuite defaultReport={defaultReport} />;
}
