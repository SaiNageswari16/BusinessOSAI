import { getActiveReceiptTemplate } from './receipt-template-store';

/**
 * High-Reliability Thermal Receipt Printer
 * Supports both direct iframe printing (zero CSS interference) and clean standard print mode.
 */
export function triggerThermalPrint(customPaperWidth?: string) {
  if (typeof window === 'undefined') return;

  const activeTemplate = getActiveReceiptTemplate();
  const paperWidth = customPaperWidth || activeTemplate.paperSize || '80mm';
  const is58 = paperWidth === '58mm';
  const printableWidth = is58 ? '48mm' : '72mm';
  const clarity = activeTemplate.printClarity || 'ultra_dark';
  const strokeVal = clarity === 'ultra_dark' ? '0.3px #000000' : '0.15px #000000';
  const fontWeightVal = clarity === 'ultra_dark' ? '800' : '700';

  const portal = document.getElementById('printable-receipt-portal');
  if (!portal) {
    console.warn('[Print] Receipt portal not found in DOM, retrying with window.print()');
    window.print();
    return;
  }

  // Attempt isolated iframe printing first (prevents blank pages & style clashes)
  try {
    const existingIframe = document.getElementById('thermal-print-iframe');
    if (existingIframe) {
      existingIframe.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'thermal-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '-9999px';
    iframe.style.width = printableWidth;
    iframe.style.height = '100px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Receipt</title>
            <style>
              @page {
                size: ${is58 ? '58mm' : '80mm'} auto;
                margin: 0mm !important;
              }
              *, *::before, *::after {
                box-sizing: border-box !important;
                margin: 0;
                padding: 0;
                color: #000000 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              html, body {
                width: ${printableWidth} !important;
                max-width: ${printableWidth} !important;
                margin: 0 auto !important;
                padding: 1.5mm !important;
                background: #ffffff !important;
                color: #000000 !important;
                font-family: 'Consolas', 'Courier New', 'Courier', monospace, system-ui !important;
                font-weight: ${fontWeightVal} !important;
                font-size: 12px !important;
                line-height: 1.25 !important;
                -webkit-text-stroke: ${strokeVal} !important;
                -webkit-font-smoothing: antialiased !important;
                text-rendering: geometricPrecision !important;
              }
              table { width: 100% !important; border-collapse: collapse !important; }
              th, td { color: #000000 !important; }
              img, svg {
                filter: grayscale(100%) contrast(300%) !important;
                max-width: 100% !important;
              }
              .border-black, [class*="border-"] {
                border-color: #000000 !important;
              }
              .bg-black {
                background-color: #000000 !important;
                color: #ffffff !important;
              }
              .bg-black * {
                color: #ffffff !important;
              }
            </style>
          </head>
          <body>
            ${portal.innerHTML}
          </body>
        </html>
      `);
      iframeDoc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error('[Thermal Print] Iframe print failed, falling back to window print:', e);
          fallbackWindowPrint(printableWidth, strokeVal, fontWeightVal);
        } finally {
          setTimeout(() => {
            try { iframe.remove(); } catch {}
          }, 60000); // keep iframe alive while print spooler processes
        }
      }, 250);
      return;
    }
  } catch (err) {
    console.warn('[Thermal Print] Iframe setup encountered an issue, falling back:', err);
  }

  // Fallback direct window print
  fallbackWindowPrint(printableWidth, strokeVal, fontWeightVal);
}

function fallbackWindowPrint(printableWidth: string, strokeVal: string, fontWeightVal: string) {
  document.body.classList.add('printing-receipt');

  let styleEl = document.getElementById('thermal-print-style-tag');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'thermal-print-style-tag';
    document.head.appendChild(styleEl);
  }

  styleEl.innerHTML = `
    @page {
      size: auto;
      margin: 0 !important;
    }
    @media print {
      @page {
        size: auto;
        margin: 0 !important;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
        overflow: visible !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body > *:not(#printable-receipt-portal),
      body #root > *:not(#printable-receipt-portal) {
        display: none !important;
        visibility: hidden !important;
      }
      #printable-receipt-portal {
        display: block !important;
        visibility: visible !important;
        position: static !important;
        width: ${printableWidth} !important;
        max-width: ${printableWidth} !important;
        padding: 1.5mm !important;
        margin: 0 auto !important;
        background: #ffffff !important;
        color: #000000 !important;
        z-index: 999999 !important;
        font-size: 12px !important;
        font-weight: ${fontWeightVal} !important;
        line-height: 1.25 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        text-rendering: geometricPrecision !important;
        -webkit-font-smoothing: antialiased !important;
        -webkit-text-stroke: ${strokeVal} !important;
        box-sizing: border-box !important;
      }
      #printable-receipt-portal * {
        visibility: visible !important;
        color: #000000 !important;
        border-color: #000000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  `;

  const cleanup = () => {
    document.body.classList.remove('printing-receipt');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.print();
    });
  });
}

