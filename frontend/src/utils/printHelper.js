/**
 * printHelper.js - Reliable printing for iframe / sandbox environments
 * 
 * Instead of using window.open('', '_blank') which is blocked by default in iframes,
 * this utility injects a styled print preview modal directly into the document body
 * and triggers window.print() with comprehensive print styles.
 */

export function printHtml(html, title = "Print Document") {
  // Save existing title
  const oldTitle = document.title;
  if (title) {
    document.title = title;
  }

  // 1. Create a unique container
  const containerId = "iframe-print-container";
  let container = document.getElementById(containerId);
  if (container) {
    container.remove();
  }
  container = document.createElement("div");
  container.id = containerId;

  // 2. Wrap HTML inside a styled print preview modal box
  container.innerHTML = `
    <div class="print-modal-box">
      <div class="print-toolbar">
        <span style="font-weight: bold; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px;">${title}</span>
        <div style="display: flex; gap: 10px; align-items: center;">
          <span style="font-size: 12px; opacity: 0.8; margin-right: 10px;">BVC ERP Print System</span>
          <button id="print-btn-action" style="
            background: #10b981; 
            color: white; 
            border: none; 
            padding: 8px 16px; 
            border-radius: 4px; 
            cursor: pointer; 
            font-weight: bold;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 6px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            transition: background 0.2s;
          ">
            <span style="font-size: 14px;">🖨</span> Print Document
          </button>
          <button id="close-btn-action" style="
            background: #ef4444; 
            color: white; 
            border: none; 
            padding: 8px 16px; 
            border-radius: 4px; 
            cursor: pointer; 
            font-weight: bold;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 6px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            transition: background 0.2s;
          ">
            ✕ Close Preview
          </button>
        </div>
      </div>
      <div class="print-content">
        ${html}
      </div>
    </div>
  `;

  // 3. Create the printing style
  const styleId = "iframe-print-style";
  let style = document.getElementById(styleId);
  if (style) {
    style.remove();
  }
  style = document.createElement("style");
  style.id = styleId;
  style.innerHTML = `
    @media screen {
      #iframe-print-container {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background: rgba(15, 23, 42, 0.75) !important;
        backdrop-filter: blur(4px) !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: center !important;
        align-items: center !important;
        z-index: 9999999 !important;
        box-sizing: border-box !important;
        padding: 40px 20px !important;
        font-family: system-ui, -apple-system, sans-serif !important;
      }
      .print-modal-box {
        background: #ffffff !important;
        width: 100% !important;
        max-width: 950px !important;
        height: auto !important;
        max-height: 90vh !important;
        border-radius: 10px !important;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1) !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
        border: 1px solid #cbd5e1 !important;
      }
      .print-toolbar {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        background: #1e3a8a !important;
        color: white !important;
        padding: 14px 20px !important;
        font-family: inherit !important;
        user-select: none !important;
      }
      #print-btn-action:hover {
        background: #059669 !important;
      }
      #close-btn-action:hover {
        background: #dc2626 !important;
      }
      .print-content {
        background: #ffffff !important;
        padding: 30px !important;
        overflow-y: auto !important;
        flex: 1 !important;
        box-sizing: border-box !important;
        color: #1e293b !important;
      }
    }
    @media print {
      @page {
        size: auto;
        margin: 10mm 12mm;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        height: auto !important;
        min-height: auto !important;
        overflow: visible !important;
        background: #ffffff !important;
        color: #000000 !important;
      }
      /* Hide all elements except the print container */
      body > *:not(#iframe-print-container) {
        display: none !important;
      }
      #iframe-print-container {
        display: block !important;
        position: static !important;
        width: 100% !important;
        height: auto !important;
        min-height: auto !important;
        background: #ffffff !important;
        padding: 0 !important;
        margin: 0 !important;
        overflow: visible !important;
        box-shadow: none !important;
        border: none !important;
        backdrop-filter: none !important;
        opacity: 1 !important;
        visibility: visible !important;
      }
      #iframe-print-container * {
        visibility: visible !important;
      }
      .print-modal-box {
        display: block !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        border: none !important;
        width: 100% !important;
        max-width: 100% !important;
        height: auto !important;
        max-height: none !important;
        background: #ffffff !important;
        overflow: visible !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .print-toolbar {
        display: none !important;
      }
      .print-content {
        display: block !important;
        width: 100% !important;
        height: auto !important;
        max-height: none !important;
        overflow: visible !important;
        padding: 0 !important;
        margin: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
      }
      /* Ensure crisp table borders and colors in print */
      table {
        width: 100% !important;
        border-collapse: collapse !important;
        page-break-inside: auto !important;
        margin-top: 10px !important;
        margin-bottom: 10px !important;
      }
      tr {
        page-break-inside: avoid !important;
        page-break-after: auto !important;
      }
      thead {
        display: table-header-group !important;
      }
      tfoot {
        display: table-footer-group !important;
      }
      th, td {
        border: 1px solid #cbd5e1 !important;
        padding: 6px 8px !important;
        font-size: 11px !important;
        color: #000000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      th {
        background-color: #1f4fb2 !important;
        color: #ffffff !important;
        font-weight: bold !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  `;

  document.body.appendChild(style);
  document.body.appendChild(container);

  // 4. Set up action handlers
  const cleanup = () => {
    document.title = oldTitle;
    container.remove();
    style.remove();
  };

  const handlePrintTrigger = () => {
    try {
      window.focus();
      window.print();
    } catch (e) {
      console.warn("Direct window.print() failed:", e);
      alert("Direct printing blocked by workspace sandbox. Press Ctrl+P or Cmd+P to open the system print dialog directly.");
    }
  };

  const printBtn = document.getElementById("print-btn-action");
  const closeBtn = document.getElementById("close-btn-action");

  if (printBtn) {
    printBtn.addEventListener("click", handlePrintTrigger);
  }
  if (closeBtn) {
    closeBtn.addEventListener("click", cleanup);
  }

  // 5. Auto-trigger print dialog using the robust iframe mechanism on load
  setTimeout(handlePrintTrigger, 300);
}

