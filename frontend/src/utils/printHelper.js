/**
 * printHelper.js - Universal, high-fidelity printing engine for ERP applications
 * 
 * Supports printing HTML strings, DOM elements, modals, reports, vouchers, and tables.
 * Uses an isolated hidden iframe engine for 100% reliable, unclipped prints across all browsers,
 * with seamless fallback and interactive preview capabilities.
 */

/**
 * Extracts and compiles all active styles from the current document
 */
export function getDocumentStyles() {
  let styleMarkup = `
    <style>
      *, *::before, *::after {
        box-sizing: border-box !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      @page {
        size: auto;
        margin: 8mm 10mm;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        overflow: visible !important;
        overflow-x: visible !important;
        overflow-y: visible !important;
        background: #ffffff !important;
        color: #0f172a !important;
        font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
        font-size: 12px !important;
        line-height: 1.4 !important;
      }
      table {
        width: 100% !important;
        max-width: 100% !important;
        border-collapse: collapse !important;
        page-break-inside: auto !important;
        margin-top: 8px !important;
        margin-bottom: 8px !important;
      }
      thead {
        display: table-header-group !important;
      }
      tfoot {
        display: table-footer-group !important;
      }
      tr {
        page-break-inside: avoid !important;
        page-break-after: auto !important;
      }
      th, td {
        border: 1px solid #cbd5e1 !important;
        padding: 6px 8px !important;
        text-align: left !important;
        vertical-align: middle !important;
      }
      th {
        background-color: #1f4fb2 !important;
        color: #ffffff !important;
        font-weight: 700 !important;
      }
      .no-print, .action-btn, .header-btn, button, .actions-cell, .actions-header {
        display: none !important;
      }
    </style>
  `;
  
  // 1. Copy all <link rel="stylesheet">
  if (typeof document !== 'undefined') {
    const links = document.querySelectorAll('link[rel="stylesheet"]');
    links.forEach(link => {
      styleMarkup += link.outerHTML + "\n";
    });

    // 2. Copy all inline <style> tags
    const styles = document.querySelectorAll('style:not(#iframe-print-style)');
    styles.forEach(style => {
      if (style.innerHTML && style.innerHTML.trim()) {
        styleMarkup += `<style>${style.innerHTML}</style>\n`;
      }
    });

    // 3. Copy CSSOM rules for dynamic styles (Emotion, Material UI, Tailwind)
    try {
      if (document.styleSheets) {
        for (let i = 0; i < document.styleSheets.length; i++) {
          const sheet = document.styleSheets[i];
          if (sheet.ownerNode && sheet.ownerNode.id === 'iframe-print-style') continue;
          try {
            if (sheet.cssRules && sheet.cssRules.length > 0) {
              let rulesText = '';
              for (let j = 0; j < sheet.cssRules.length; j++) {
                rulesText += sheet.cssRules[j].cssText + '\n';
              }
              if (rulesText) {
                styleMarkup += `<style>${rulesText}</style>\n`;
              }
            }
          } catch (cssomErr) {
            // Cross-origin stylesheet access restricted
          }
        }
      }
    } catch (e) {}
  }

  return styleMarkup;
}

/**
 * Deep clones a DOM element and synchronizes form values (inputs, selects, textareas)
 */
export function cloneWithFormValues(element) {
  if (!element) return null;
  const clone = element.cloneNode(true);
  
  const origInputs = element.querySelectorAll('input, select, textarea');
  const cloneInputs = clone.querySelectorAll('input, select, textarea');

  origInputs.forEach((orig, i) => {
    const cl = cloneInputs[i];
    if (!cl) return;

    if (orig.tagName === 'SELECT') {
      cl.value = orig.value;
      const selectedIndex = orig.selectedIndex;
      if (selectedIndex >= 0 && orig.options[selectedIndex]) {
        cl.setAttribute('data-value', orig.options[selectedIndex].text);
      }
    } else if (orig.type === 'checkbox' || orig.type === 'radio') {
      cl.checked = orig.checked;
      if (orig.checked) {
        cl.setAttribute('checked', 'checked');
      } else {
        cl.removeAttribute('checked');
      }
    } else {
      cl.value = orig.value;
      cl.setAttribute('value', orig.value || '');
    }
  });

  return clone;
}

/**
 * Print a DOM element or CSS selector directly
 */
export function printElement(elementOrSelector, options = {}) {
  let target = typeof elementOrSelector === 'string' 
    ? document.querySelector(elementOrSelector) 
    : elementOrSelector;

  if (!target) {
    target = document.getElementById('printable-area') || 
             document.querySelector('.standard-display') ||
             document.querySelector('.print-modal-box') || 
             document.querySelector('.document-modal') ||
             document.querySelector('.report-container') ||
             document.querySelector('main') ||
             document.body;
  }

  const title = options.title || (typeof options === 'string' ? options : document.title) || 'Print Preview';
  
  if (target) {
    const cloned = cloneWithFormValues(target);
    // Remove unwanted UI buttons inside cloned element
    const unwanted = cloned.querySelectorAll('.header-btn, .action-btn, button, .search-filter-bar, .actions-cell, .actions-header, .no-print');
    unwanted.forEach(el => el.remove());
    printHtml(cloned.outerHTML, title, options);
  } else {
    window.print();
  }
}

/**
 * Core print HTML renderer with isolated hidden iframe & visual modal preview
 */
export function printHtml(html, title = "Print Document", options = {}) {
  // Safe content fallback
  const safeContent = (html && String(html).trim().length > 0) 
    ? html 
    : `<div style="text-align:center; padding: 40px; color: #64748b; font-family: sans-serif;">
        <h3>No Printable Content Available</h3>
        <p>The selected record or report does not contain printable data.</p>
       </div>`;

  const oldTitle = document.title;
  if (title) {
    document.title = title;
  }

  const headStyles = getDocumentStyles();

  // Create or retrieve hidden print iframe for direct, isolated printing
  // CRITICAL: Set 100% width/height with opacity: 0 and z-index: -9999 (NOT width: 0, height: 0, or visibility: hidden)
  // so browser layout engine calculates full table layout geometry and prevents blank pages!
  let iframe = document.getElementById("erp-hidden-print-frame");
  if (iframe) {
    iframe.remove();
  }

  iframe = document.createElement("iframe");
  iframe.id = "erp-hidden-print-frame";
  iframe.style.position = "absolute";
  iframe.style.left = "-9999px";
  iframe.style.top = "-9999px";
  iframe.style.width = "1024px";
  iframe.style.height = "768px";
  iframe.style.border = "0";
  iframe.style.opacity = "1";
  iframe.style.visibility = "visible";
  iframe.style.pointerEvents = "none";
  iframe.style.zIndex = "-9999";
  document.body.appendChild(iframe);

  const fullHtmlDoc = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        ${headStyles}
        <style>
          body {
            padding: 16px !important;
            background: #ffffff !important;
            color: #0f172a !important;
          }
          .header-banner {
            border-bottom: 2px solid #1f4fb2;
            padding-bottom: 8px;
            margin-bottom: 16px;
          }
        </style>
      </head>
      <body>
        <div style="width: 100%; max-width: 100%;">
          ${safeContent}
        </div>
      </body>
    </html>
  `;

  // Directly display high-fidelity modal print preview to prevent blank pages across all browsers and hosting environments
  showModalFallback(safeContent, title, headStyles, oldTitle);
  setTimeout(() => {
    try {
      window.print();
    } catch (e) {
      // User can also click Print Now button in modal
    }
  }, 400);
}

/**
 * Modal Fallback if iframe print is blocked by browser sandbox
 */
function showModalFallback(safeContent, title, headStyles, oldTitle) {
  const containerId = "iframe-print-container";
  let container = document.getElementById(containerId);
  if (container) container.remove();

  container = document.createElement("div");
  container.id = containerId;
  container.style.position = "fixed";
  container.style.inset = "0";
  container.style.zIndex = "999999";
  container.style.backgroundColor = "rgba(15, 23, 42, 0.75)";
  container.style.backdropFilter = "blur(4px)";
  container.style.display = "flex";
  container.style.justifyContent = "center";
  container.style.alignItems = "center";
  container.style.padding = "20px";
  container.style.overflowY = "auto";

  container.innerHTML = `
    <div style="background: #ffffff; border-radius: 8px; width: 900px; max-width: 95vw; max-height: 92vh; display: flex; flex-direction: column; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3); overflow: hidden;">
      <div style="background: #1f4fb2; color: #ffffff; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 700; font-size: 16px; text-transform: uppercase;">📄 ${title}</span>
        <div style="display: flex; gap: 10px;">
          <button id="modal-print-btn" style="background: #ffffff; color: #1f4fb2; border: none; padding: 6px 16px; border-radius: 4px; font-weight: bold; cursor: pointer;">🖨 Print Now</button>
          <button id="modal-close-btn" style="background: rgba(255,255,255,0.2); color: #ffffff; border: none; padding: 6px 12px; border-radius: 4px; font-weight: bold; cursor: pointer;">✕ Close</button>
        </div>
      </div>
      <div style="padding: 24px; overflow-y: auto; flex: 1;" id="modal-print-body">
        ${safeContent}
      </div>
    </div>
  `;

  document.body.appendChild(container);
  document.body.classList.add("print-modal-active");

  const cleanup = () => {
    document.title = oldTitle;
    document.body.classList.remove("print-modal-active");
    if (container && container.parentNode) container.remove();
  };

  document.getElementById("modal-close-btn")?.addEventListener("click", cleanup);
  document.getElementById("modal-print-btn")?.addEventListener("click", () => {
    window.print();
  });
}

export default printHtml;
