const SESSION_ID = crypto.randomUUID();
console.log('[AutoFill] Content script loaded. Session ID:', SESSION_ID);

let pageFields = [];
let hasUserInitiatedFill = false;

const filledElements = new WeakSet();

async function handleReviewDecisions(decisions) {
  for (const d of decisions) {
    if (d.action === 'fill_file' && d.fileId) {
      await globalThis.FileUploadHandler.injectFile(d.field.element, d.fileId);
      filledElements.add(d.field.element);
      globalThis.DatasetCollector.logEvent(d.field.fieldMeta, d.field.classification, true, 1, true, null, false);
    } else if (d.action === 'fill_text') {
      const profile = await globalThis.ProfileStore.getProfile();
      const val = globalThis.AutofillEngine.getProfileValueForCategory(d.category, profile);
      if (val) {
         const res = await globalThis.AutofillEngine.fillField(d.field.element, val, d.field.fieldMeta.inputType, d.field.fieldMeta);
         filledElements.add(d.field.element);
         globalThis.DatasetCollector.logEvent(d.field.fieldMeta, d.field.classification, res.success, res.tier, true, d.category, false);
      } else {
         globalThis.DatasetCollector.logEvent(d.field.fieldMeta, d.field.classification, false, null, true, d.category, true);
      }
    } else if (d.action === 'skip') {
      globalThis.DatasetCollector.logEvent(d.field.fieldMeta, d.field.classification, false, null, true, null, true);
    }
  }
}

async function processFields(fieldsToProcess, onReviewDismiss) {
  const profile = await globalThis.ProfileStore.getProfile();
  let fieldsToReview = [];
  
  // === DEBUG DOM DUMP ===
  setTimeout(() => {
    const htmlDump = [];
    const radios = document.querySelectorAll('input[type="radio"], input[role="radio"], [role="radio"]');
    if(radios.length > 0) {
       let current = radios[0];
       for(let i=0; i<8; i++) {
           htmlDump.push(`${current.tagName} (role=${current.getAttribute('role')}, type=${current.getAttribute('type')}, name=${current.getAttribute('name')}, class=${current.className})`);
           current = current.parentElement;
           if(!current) break;
       }
    }
    console.log("HTML_DUMP_START:" + JSON.stringify(htmlDump) + ":HTML_DUMP_END");
  }, 5000);
  
  for (const f of fieldsToProcess) {
    if (filledElements.has(f.element)) continue;
    
    if (f.classification.fillRoute === 'autofill') {
      const val = globalThis.AutofillEngine.getProfileValueForCategory(f.classification.assignedCategory, profile);
      const res = await globalThis.AutofillEngine.fillField(f.element, val, f.fieldMeta.inputType, f.fieldMeta);
      
      globalThis.DatasetCollector.logEvent(
        f.fieldMeta, f.classification, res.success, res.tier, false, null, false
      );
      
      if (!res.success) {
        f.classification.fillRoute = 'overlay';
        fieldsToReview.push(f);
      } else {
        filledElements.add(f.element);
      }
    } else {
      fieldsToReview.push(f);
    }
  }

  if (fieldsToReview.length > 0) {
    globalThis.ShadowOverlay.init();
    const shown = await globalThis.ShadowOverlay.showReviewPanel(
      fieldsToReview,
      handleReviewDecisions,
      onReviewDismiss  // called when user clicks "Dismiss" on the panel
    );
    if (!shown) {
      console.warn("Fallback mode: Shadow DOM unavailable.");
      // Panel couldn't be shown — invoke callback immediately
      if (onReviewDismiss) onReviewDismiss();
    }
  } else {
    // Nothing to review — invoke callback immediately so the widget reappears
    if (onReviewDismiss) onReviewDismiss();
  }
}


async function orchestrateFill() {
  const extracted = await globalThis.AutofillEngine.extractFields();
  pageFields = await Promise.all(extracted.map(async f => ({
    fieldMeta: f,
    classification: await globalThis.BaseClassifier.classify(f),
    element: f.element
  })));

  // Re-inject the floating widget once the review panel is dismissed
  // (or immediately if there is nothing to review).
  // This way the button never overlaps the open review panel.
  await processFields(pageFields, () => {
    widgetInjected = false;
    injectFloatingWidget();
  });
}


let widgetInjected = false;
function injectFloatingWidget() {
  if (widgetInjected || pageFields.length === 0) return;
  widgetInjected = true;

  const host = document.createElement('div');
  host.id = 'pilot-widget-host';
  host.style.cssText = 'position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'closed' });
  const btn = document.createElement('button');
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.style.verticalAlign = "middle";
  svg.style.marginRight = "4px";
  svg.style.color = "#AF52DE";

  const path1 = document.createElementNS(svgNS, "path");
  path1.setAttribute("d", "m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z");
  const path2 = document.createElementNS(svgNS, "path"); path2.setAttribute("d", "m14 7 3 3");
  const path3 = document.createElementNS(svgNS, "path"); path3.setAttribute("d", "M5 6v4");
  const path4 = document.createElementNS(svgNS, "path"); path4.setAttribute("d", "M19 14v4");
  const path5 = document.createElementNS(svgNS, "path"); path5.setAttribute("d", "M10 2v2");
  const path6 = document.createElementNS(svgNS, "path"); path6.setAttribute("d", "M7 8H3");
  const path7 = document.createElementNS(svgNS, "path"); path7.setAttribute("d", "M21 16h-4");
  const path8 = document.createElementNS(svgNS, "path"); path8.setAttribute("d", "M11 3H9");

  svg.appendChild(path1); svg.appendChild(path2); svg.appendChild(path3); svg.appendChild(path4);
  svg.appendChild(path5); svg.appendChild(path6); svg.appendChild(path7); svg.appendChild(path8);

  btn.appendChild(svg);
  btn.appendChild(document.createTextNode(' Fill with Pilot'));
  
  btn.style.cssText = `
    padding: 12px 20px;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(0, 122, 255, 0.3);
    border-radius: 24px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    color: #007AFF;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    font-family: -apple-system, system-ui, sans-serif;
    transition: all 0.2s ease;
  `;
  
  btn.onmouseover = () => {
    btn.style.transform = 'translateY(-2px)';
    btn.style.boxShadow = '0 12px 40px rgba(0, 122, 255, 0.2)';
    btn.style.background = '#007AFF';
    btn.style.color = '#fff';
  };
  btn.onmouseout = () => {
    btn.style.transform = 'translateY(0)';
    btn.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
    btn.style.background = 'rgba(255, 255, 255, 0.9)';
    btn.style.color = '#007AFF';
  };

  btn.onclick = () => {
    btn.textContent = 'Filling...';
    hasUserInitiatedFill = true;
    orchestrateFill().then(() => {
      host.remove();
      widgetInjected = false;
    });
  };

  shadow.appendChild(btn);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_STATUS') {
    const reviewCount = pageFields.filter(f => f.classification && f.classification.fillRoute !== 'autofill').length;
    sendResponse({ totalFields: pageFields.length, reviewCount });
    return true;
  }
  
  if (request.action === 'FILL_ALL') {
    hasUserInitiatedFill = true;
    orchestrateFill();
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'REVIEW_FIELDS') {
    globalThis.ShadowOverlay.init();
    const reviewFields = pageFields.filter(f => f.classification.fillRoute !== 'autofill');
    globalThis.ShadowOverlay.showReviewPanel(reviewFields, handleReviewDecisions);
    sendResponse({ success: true });
    return true;
  }
});

/**
 * Returns true only for confirmed ATS/job-application domains where
 * auto-triggering the fill (without user clicking the button) makes sense.
 * Generic pages, Google Forms, and any non-ATS site return false so that
 * the "Fill with Pilot" button is always shown first.
 */
function isStrictATSDomain() {
  const url = window.location.href.toLowerCase();

  // Explicitly exclude Google Forms and similar generic form hosts
  const genericHosts = ['docs.google.com', 'forms.gle', 'typeform.com', 'surveymonkey.com', 'jotform.com', 'forms.office.com', 'forms.cloud.microsoft', 'airtable.com'];
  if (genericHosts.some(h => url.includes(h))) return false;

  try {
    if (sessionStorage.getItem('pilot_active_job_app') === 'true') return true;
  } catch (e) {}

  const atsDomains = ['greenhouse.io', 'lever.co', 'workday', 'icims.com', 'taleo.net', 'bamboohr.com', 'ashbyhq.com', 'myworkdayjobs.com'];
  if (atsDomains.some(d => url.includes(d))) {
    try { sessionStorage.setItem('pilot_active_job_app', 'true'); } catch (e) {}
    return true;
  }

  return false;
}

// Legacy alias kept for any future use — checks broader signals but is no longer
// used to gate the auto-trigger so it doesn't suppress the floating widget.
function isJobApplication(fields) {
  if (isStrictATSDomain()) return true;

  const url = window.location.href.toLowerCase();
  const hasCareerPath = url.includes('/careers') || url.includes('/jobs') || url.includes('/apply');
  
  const docTitle = (document.title || '').toLowerCase();
  const headings = Array.from(document.querySelectorAll('h1, h2')).map(h => h.innerText.toLowerCase());
  const allTextContext = [docTitle, ...headings].join(' ');
  const titleKeywords = ['job application', 'submit application', 'careers', 'apply for', 'applicant', 'career opportunity'];
  const hasTitleMatch = titleKeywords.some(kw => allTextContext.includes(kw));

  if (hasCareerPath || hasTitleMatch) {
    try { sessionStorage.setItem('pilot_active_job_app', 'true'); } catch (e) {}
    return true;
  }

  const recognizedCategories = new Set(fields.map(f => f.classification.assignedCategory).filter(c => c !== 'UNKNOWN'));
  if (recognizedCategories.size >= 4) {
    const strongIndicators = ['RESUME', 'LINKEDIN', 'UNIVERSITY', 'YEARS_EXPERIENCE', 'PORTFOLIO', 'CURRENT_COMPANY', 'CURRENT_TITLE', 'NOTICE_PERIOD', 'RELOCATION', 'WORK_AUTHORIZATION'];
    if (strongIndicators.some(indicator => recognizedCategories.has(indicator))) {
      try { sessionStorage.setItem('pilot_active_job_app', 'true'); } catch (e) {}
      return true;
    }
  }
  
  return false;
}

function init() {
  if (window.self !== window.top) return; 
  console.log('[AutoFill] Initialization started.');

  globalThis.FormMutationObserver.setCallback(async (newFields) => {
    if (newFields === 'FULL') {
      if (hasUserInitiatedFill) {
         await orchestrateFill();
      } else {
         const extracted = await globalThis.AutofillEngine.extractFields();
         pageFields = await Promise.all(extracted.map(async f => ({
           fieldMeta: f,
           classification: await globalThis.BaseClassifier.classify(f),
           element: f.element
         })));
         injectFloatingWidget();
      }
    } else if (Array.isArray(newFields) && newFields.length > 0) {
      const extractedFields = await Promise.all(newFields.map(async f => ({
        fieldMeta: f,
        classification: await globalThis.BaseClassifier.classify(f),
        element: f.element
      })));
      pageFields = pageFields.concat(extractedFields);
      if (hasUserInitiatedFill) {
         await processFields(extractedFields);
      }
    }
  });
  
  globalThis.AutofillEngine.extractFields().then(async extracted => {
    pageFields = await Promise.all(extracted.map(async f => ({
      fieldMeta: f,
      classification: await globalThis.BaseClassifier.classify(f),
      element: f.element
    })));

    console.log(`[AutoFill] Scanned ${pageFields.length} fields.`);

    if (pageFields.length > 0) {
      chrome.storage.local.get(['autoFillMode'], (res) => {
        // Auto-trigger ONLY on strict ATS domains when autoFillMode is enabled.
        // For Google Forms and any other generic page, always show the floating
        // widget button first so the user can review before anything is filled.
        const shouldAutoFill = res.autoFillMode && isStrictATSDomain();
        console.log(`[AutoFill] autoFillMode=${res.autoFillMode}, isStrictATS=${isStrictATSDomain()}, shouldAutoFill=${shouldAutoFill}`);
        if (shouldAutoFill) {
          hasUserInitiatedFill = true;
          orchestrateFill();
        } else {
          injectFloatingWidget();
        }
      });
    } else {
      console.log('[AutoFill] No fields found — widget not injected.');
    }
  });
  globalThis.FormMutationObserver.startObserver();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
