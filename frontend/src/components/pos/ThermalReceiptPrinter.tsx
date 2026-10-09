'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTenant } from "@/contexts/tenant-context";
import { generateThermalReceiptHtml } from '@/lib/print-helper';

interface ThermalReceiptPrinterProps {
  bill: any;
  customTemplate?: any;
}

export function ThermalReceiptPrinter({ bill, customTemplate }: ThermalReceiptPrinterProps) {
  const { tenant } = useTenant();
  const [, setTick] = useState(0);

  // Re-render in real-time if invoice settings, GST details, payment QR, or signature change
  useEffect(() => {
    const handleUpdate = () => setTick((v) => v + 1);
    if (typeof window !== 'undefined') {
      window.addEventListener('bos-invoice-settings-changed', handleUpdate);
      window.addEventListener('bos-active-gst-changed', handleUpdate);
      window.addEventListener('bos-payment-qr-changed', handleUpdate);
      window.addEventListener('bos-signature-settings-changed', handleUpdate);
      window.addEventListener('bos-receipt-template-changed', handleUpdate);
      return () => {
        window.removeEventListener('bos-invoice-settings-changed', handleUpdate);
        window.removeEventListener('bos-active-gst-changed', handleUpdate);
        window.removeEventListener('bos-payment-qr-changed', handleUpdate);
        window.removeEventListener('bos-signature-settings-changed', handleUpdate);
        window.removeEventListener('bos-receipt-template-changed', handleUpdate);
      };
    }
  }, []);

  if (!bill) return null;
  if (typeof document === 'undefined') return null;

  const currentTenantId = (tenant as any)?.raw?.tenant_id || (tenant as any)?.tenant_id || tenant?.id || 'default';
  const htmlContent = generateThermalReceiptHtml(bill, customTemplate, currentTenantId);

  return createPortal(
    <div
      id="printable-receipt-portal"
      className="hidden print:block bg-white text-black p-0 select-none print:static print:visible pointer-events-none print:pointer-events-auto"
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />,
    document.body
  );
}
