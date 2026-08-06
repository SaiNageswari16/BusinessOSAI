import { getActiveReceiptTemplate } from './receipt-template-store';

export function triggerThermalPrint(customPaperWidth?: string) {
  if (typeof window === 'undefined') return;

  const activeTemplate = getActiveReceiptTemplate();
  const paperWidth = customPaperWidth || activeTemplate.paperSize || '80mm';
  const is58 = paperWidth === '58mm';
  const printableWidth = is58 ? '48mm' : '72mm';

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
        size: auto !important;
        margin: 0mm !important;
      }
      html, body {
        width: 100% !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
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
        width: ${printableWidth} !important;
        max-width: ${printableWidth} !important;
        padding: 1mm 2mm !important;
        margin: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
        z-index: 999999 !important;
        font-family: 'Courier New', Courier, monospace !important;
        box-sizing: border-box !important;
      }
      #printable-receipt-portal * {
        visibility: visible !important;
        color: #000000 !important;
        background: transparent !important;
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
