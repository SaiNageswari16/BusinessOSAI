'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTenant } from "@/contexts/tenant-context";
import { generateThermalReceiptHtml } from '@/lib/print-helper';

interface ThermalReceiptPrinterProps {
  bill: any;
  customTemplate?: any;
}

export function ThermalReceiptPrinter({ bill }: ThermalReceiptPrinterProps) {
  // ThermalReceiptPrinter is rendered only if bill is present.
  // We do not render global html/body tags to avoid corrupting the main app window.
  // In-page printing is executed reliably via isolated iframes in print-helper.ts.
  return null;
}
