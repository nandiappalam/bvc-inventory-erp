/**
 * printHelper.js - Reliable printing for iframe / sandbox environments
 * 
 * Injects a styled print preview modal directly into the document body
 * allowing visual preview and triggering window.print() with comprehensive print styles.
 */

export function printHtml(html, title = "Print Document") {
  // Safe content fallback
  const safeContent = (html && String(html).trim().length > 0) 
    ? html 
    : `<div style="text-align:center; padding: 40px; color: #64748b;">
        <h3>No Printable Content Available</h3>
        <p>The selected record or report does not contain any printable data.</p>
       </div>`;

  // Save existing title
  const oldTitle = document.title;
  if (title) {
    document.title = title;
  }

  // 1. Create unique container
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
        <span style="font-weight: bold; font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px;">${title}</span>
        <div style="display: flex; gap: 10px; align-items: center;">
          <button id="print-btn-action" style="
            background: #10b981; 
            color: white; 
            border: none; 
            padding: 7px 16px; 
            border-radius: 4px; 
            cursor: pointer; 
            font-weight: bold;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 6px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          ">
            🖨 Print
          </button>
          <button id="close-btn-action" style="
            background: #ef4444; 
            color: white; 
            border: none; 
            padding: 7px 16px; 
            border-radius: 4px; 
            cursor: pointer; 
            font-weight: bold;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 6px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          ">
            ✕ Close
          </button>
        </div>
      </div>
      <div class="print-content">
        ${safeContent}
      </div>
    </div>
  `;

  // 3. Create printing style
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
        background: rgba(15, 23, 42, 0.7) !important;
        backdrop-filter: blur(3px) !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: center !important;
        align-items: center !important;
        z-index: 9999999 !important;
        box-sizing: border-box !important;
        padding: 24px 16px !important;
        font-family: system-ui, -apple-system, sans-serif !important;
      }
      .print-modal-box {
        background: #ffffff !important;
        width: 100% !important;
        max-width: 950px !important;
        height: auto !important;
        max-height: 92vh !important;
        border-radius: 8px !important;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 10px 10px -5px rgba(0, 0, 0, 0.1) !important;
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
        padding: 12px 18px !important;
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
        padding: 24px !important;
        overflow-y: auto !important;
        flex: 1 !important;
        box-sizing: border-box !important;
        color: #1e293b !important;
      }
    }
    @media print {
      @page {
        size: auto;
        margin: 8mm 10mm;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        height: auto !important;
        min-height: auto !important;
        overflow: visible !important;
        background: #ffffff !important;
        color: #000000 !important;
        width: 100% !important;
        position: static !important;
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
      table {
        width: 100% !important;
        border-collapse: collapse !important;
        page-break-inside: auto !important;
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
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  `;

  document.body.appendChild(style);
  document.body.appendChild(container);

  // 4. Action handlers & cleanup
  const cleanup = () => {
    document.title = oldTitle;
    if (container && container.parentNode) container.remove();
    if (style && style.parentNode) style.remove();
    document.removeEventListener("keydown", handleKeyDown);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      cleanup();
    }
  };

  const handlePrintTrigger = () => {
    try {
      window.focus();
      window.print();
    } catch (e) {
      console.warn("Direct window.print() error:", e);
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

  // Close when clicking outside modal box
  container.addEventListener("click", (e) => {
    if (e.target === container) {
      cleanup();
    }
  });

  document.addEventListener("keydown", handleKeyDown);

  // Auto-trigger print dialog after small render delay
  setTimeout(handlePrintTrigger, 300);
}
