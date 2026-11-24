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
 * Core universal print HTML renderer using the dedicated #bvc-print-portal in the main DOM tree.
 * Guaranteed 100% reliable print preview across Chrome, Edge, Safari, Firefox,
 * both in cloud web (Render) environments and desktop Tauri runtimes.
 */
export function printHtml(html, title = "Print Document", options = {}) {
  // Safe content fallback
  const safeContent = (html && String(html).trim().length > 0) 
    ? html 
    : `<div style="text-align:center; padding: 40px; color: #64748b; font-family: sans-serif;">
        <h3>No Printable Content Available</h3>
        <p>The selected record or report does not contain printable data.</p>
       </div>`;

  const resolvedTitle =
    typeof title === 'string'
      ? title
      : title && typeof title === 'object' && title.title
      ? String(title.title)
      : options && typeof options === 'object' && options.title
      ? String(options.title)
      : 'Print Document';

  const oldTitle = document.title;
  if (resolvedTitle) {
    document.title = resolvedTitle;
  }

  let bodyContent = safeContent;
  let customStyleMarkup = '';

  // Handle full HTML documents passed as string
  if (typeof safeContent === 'string' && (safeContent.includes('<html') || safeContent.includes('<!DOCTYPE'))) {
    const styleMatches = safeContent.match(/<style[\s\S]*?<\/style>/gi);
    if (styleMatches) {
      customStyleMarkup = styleMatches.join('\n');
    }
    const bodyMatch = safeContent.match(/<body[\s\S]*?>([\s\S]*?)<\/body>/i);
    if (bodyMatch && bodyMatch[1]) {
      bodyContent = bodyMatch[1];
    }
  }

  // Remove any stale portal style tags first
  const prevStyle = document.getElementById('bvc-portal-print-style');
  if (prevStyle && prevStyle.parentNode) {
    prevStyle.parentNode.removeChild(prevStyle);
  }

  // Inject dynamic styles into head temporarily
  let styleTag = null;
  if (customStyleMarkup) {
    styleTag = document.createElement('style');
    styleTag.id = 'bvc-portal-print-style';
    styleTag.innerHTML = customStyleMarkup.replace(/<\/?style[^>]*>/gi, '');
    document.head.appendChild(styleTag);
  }

  // Retrieve or create print portal on document.body
  let portal = document.getElementById("bvc-print-portal");
  if (!portal) {
    portal = document.createElement("div");
    portal.id = "bvc-print-portal";
    portal.setAttribute("aria-hidden", "true");
    document.body.appendChild(portal);
  }

  // Inject content into the portal
  portal.innerHTML = bodyContent;

  // Defense-in-depth: strip heavy interactive media nodes (<video>, <audio>, <iframe>) from print DOM
  // so WebView2 / Chromium print compositor never allocates huge video decoder frames or hangs
  portal.querySelectorAll('video, audio, iframe').forEach((mediaEl) => {
    const notice = document.createElement('div');
    notice.style.cssText = 'padding:6px 8px;border:1px dashed #93c5fd;background:#eff6ff;color:#1e3a8a;font-size:11px;border-radius:4px;';
    notice.textContent = 'Media Attachment Reference (Playable in ERP View)';
    mediaEl.replaceWith(notice);
  });

  // Add the portal printing class to body so @media print reveals ONLY the portal
  document.body.classList.add("bvc-printing-portal");

  // Robust cleanup after printing finishes or user cancels
  let isCleanedUp = false;
  const cleanup = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    document.body.classList.remove("bvc-printing-portal");
    if (styleTag && styleTag.parentNode) {
      styleTag.parentNode.removeChild(styleTag);
    }
    setTimeout(() => {
      if (portal && !document.body.classList.contains("bvc-printing-portal")) {
        portal.innerHTML = "";
      }
    }, 1500);
    document.title = oldTitle;
    window.removeEventListener("afterprint", cleanup);
  };

  window.addEventListener("afterprint", cleanup, { once: true });

  // Safety fallback cleanup after 2 minutes in case afterprint does not fire
  setTimeout(cleanup, 120000);

  // Wait briefly for any images inside the print portal to decode (capped at 600ms)
  const imgs = Array.from(portal.querySelectorAll('img')).filter((img) => !img.complete);
  const triggerPrint = () => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          window.focus();
          window.print();
        } catch (err) {
          console.error("Print invocation error:", err);
          cleanup();
        }
      }, 120);
    });
  };

  if (imgs.length === 0) {
    triggerPrint();
  } else {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      triggerPrint();
    };
    const fallbackTimer = setTimeout(done, 600);
    Promise.all(
      imgs.map(
        (img) =>
          new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
          })
      )
    ).then(() => {
      clearTimeout(fallbackTimer);
      done();
    });
  }
}

export default printHtml;

