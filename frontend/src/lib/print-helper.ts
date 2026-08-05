import { getActiveReceiptTemplate } from './receipt-template-store';

export function triggerThermalPrint(customPaperWidth?: string) {
  if (typeof window === 'undefined') return;

  const activeTemplate = getActiveReceiptTemplate();
  const paperWidth = customPaperWidth || activeTemplate.paperSize || '80mm';

  document.body.classList.add('printing-receipt');

  // Enforce @page style tag dynamically for thermal roll paper sizes (80mm / 58mm)
  let styleEl = document.getElementById('thermal-print-style-tag');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'thermal-print-style-tag';
    document.head.appendChild(styleEl);
  }

  styleEl.innerHTML = `
    @media print {
      @page {
        size: ${paperWidth} portrait !important;
        margin: 0mm !important;
      }
      html, body {
        width: ${paperWidth} !important;
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
        color: black !important;
        overflow: visible !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body > *:not(#printable-receipt-portal),
      #root > *:not(#printable-receipt-portal),
      header, nav, footer, .no-print, [data-no-print] {
        display: none !important;
        visibility: hidden !important;
      }
      #printable-receipt-portal {
        display: block !important;
        visibility: visible !important;
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: ${paperWidth} !important;
        max-width: ${paperWidth} !important;
        padding: 2mm 3mm !important;
        margin: 0 !important;
        background: white !important;
        color: black !important;
        z-index: 999999 !important;
        font-family: 'Courier New', Courier, monospace !important;
        box-sizing: border-box !important;
      }
      #printable-receipt-portal * {
        visibility: visible !important;
        color: black !important;
        box-sizing: border-box !important;
      }
    }
  `;

  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-receipt');
    }, 1000);
  }, 150);
}
