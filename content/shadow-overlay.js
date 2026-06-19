globalThis.ShadowOverlay = (function() {
  let host = null;
  let shadow = null;
  let svgLayer = null;
  let panel = null;
  let catDropdownPortal = null;

  let currentFields = [];

  // ── Category search helpers ────────────────────────────────────────────────
  const ALL_CATEGORIES = [
    'UNKNOWN','FIRST_NAME','MIDDLE_NAME','LAST_NAME','PREFERRED_NAME','FULL_NAME',
    'EMAIL','PHONE','BIRTHDAY','PRONOUNS',
    'ADDRESS_LINE_1','ADDRESS_LINE_2','CITY','STATE','ZIP','COUNTRY',
    'CURRENT_COMPANY','CURRENT_TITLE','YEARS_OF_EXPERIENCE',
    'UNIVERSITY','FACULTY','DEGREE','FIELD_OF_STUDY','STUDENT_LEVEL','GPA','GRADUATION_YEAR',
    'SALARY_EXPECTATION','START_DATE','NOTICE_PERIOD','RELOCATION','TRAVEL_PERCENTAGE',
    'LANGUAGES','WORK_AUTHORIZATION','REFERRAL',
    'LINKEDIN','GITHUB','PORTFOLIO',
    'ESSAY_QUESTION','COVER_LETTER_TEXT'
  ];

  function toDisplayName(cat) {
    return cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function scoreCategory(cat, query) {
    if (!query || query.trim() === '') return 0; // 0 = unfiltered, all equal
    const c = cat.toLowerCase().replace(/_/g, ' ');
    const q = query.toLowerCase().replace(/_/g, ' ').trim();
    if (c === q) return 100;
    if (c.startsWith(q)) return 80;
    const words = c.split(' ');
    if (words.some(w => w.startsWith(q))) return 60;
    if (c.includes(q)) return 40;
    // match any word contains the query as substring
    if (words.some(w => w.includes(q))) return 20;
    return 1; // still shown — just sorted to bottom
  }

  function renderCategoryDropdown(inputEl) {
    if (!catDropdownPortal) return;
    const query = inputEl.value;
    const scored = ALL_CATEGORIES
      .map(cat => ({ cat, score: scoreCategory(cat, query) }))
      .sort((a, b) => b.score - a.score || a.cat.localeCompare(b.cat));

    catDropdownPortal.textContent = '';
    scored.forEach(({ cat, score }) => {
      const item = document.createElement('div');
      item.className = 'cat-item'
        + (cat === inputEl.value ? ' cat-selected' : '')
        + (score >= 40 && query.trim() ? ' cat-match' : '');
      const name = document.createElement('span');
      name.className = 'cat-name';
      name.textContent = toDisplayName(cat);
      const code = document.createElement('span');
      code.className = 'cat-code';
      code.textContent = cat;
      item.appendChild(name);
      item.appendChild(code);
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        inputEl.value = cat;
        catDropdownPortal.style.display = 'none';
      });
      catDropdownPortal.appendChild(item);
    });

    const rect = inputEl.getBoundingClientRect();
    catDropdownPortal.style.top    = (rect.bottom + 4) + 'px';
    catDropdownPortal.style.left   = rect.left + 'px';
    catDropdownPortal.style.width  = rect.width + 'px';
    catDropdownPortal.style.display = 'block';

    // Scroll selected item into view
    const sel = catDropdownPortal.querySelector('.cat-selected');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }

  function attachSearchableInput(inputEl) {
    inputEl.autocomplete = 'off';
    inputEl.addEventListener('focus', () => renderCategoryDropdown(inputEl));
    inputEl.addEventListener('input', () => renderCategoryDropdown(inputEl));
    inputEl.addEventListener('blur', () => {
      setTimeout(() => { if (catDropdownPortal) catDropdownPortal.style.display = 'none'; }, 200);
    });
  }
  // ──────────────────────────────────────────────────────────────────────────
  
  let ttPolicy = null;
  if (window.trustedTypes && window.trustedTypes.createPolicy) {
    try {
      ttPolicy = window.trustedTypes.createPolicy('pilot-extension-overlay', {
        createHTML: string => string
      });
    } catch (e) {
      if (window.trustedTypes.getAttributeType) {
        try {
          ttPolicy = window.trustedTypes.createPolicy('default', { createHTML: string => string });
        } catch (err) {}
      }
    }
  }

  function safeHTML(html) {
    return ttPolicy ? ttPolicy.createHTML(html) : html;
  }

  function init() {
    if (host) return;
    
    host = document.createElement('div');
    host.id = 'autofill-overlay-host';
    host.style.cssText = `
      position: fixed; top: 0; left: 0;
      width: 0; height: 0;
      pointer-events: none;
      z-index: 2147483647;
    `;
    document.body.appendChild(host);
    
    try {
      shadow = host.attachShadow({ mode: 'closed' });
    } catch (e) {
      console.warn('[AutoFill] Failed to attach Shadow DOM (CSP restricted). Fallback mode active.');
      return;
    }

    svgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgLayer.style.cssText = `
      position: fixed; top: 0; left: 0;
      width: 100vw; height: 100vh;
      pointer-events: none;
    `;
    shadow.appendChild(svgLayer);

    panel = document.createElement('div');
    panel.style.cssText = `
      position: fixed;
      width: 320px;
      max-height: 80vh;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
      border: 1px solid rgba(255, 255, 255, 0.5);
      pointer-events: all;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: none;
      flex-direction: column;
    `;
    shadow.appendChild(panel);
    
    const style = document.createElement('style');
    style.textContent = `
      .list-container { flex: 1; overflow-y: auto; min-height: 0; }
      .review-row { padding: 16px; border-bottom: 1px solid rgba(0,0,0,0.05); }
      .review-row:last-child { border-bottom: none; }
      .label-preview { font-size: 14px; font-weight: 600; color: #1D1D1F; margin-bottom: 8px; }
      .suggestion { font-size: 13px; color: #86868B; margin-bottom: 8px; }
      .controls { display: flex; gap: 8px; }
      select, input.cat-search { flex: 1; padding: 8px 12px; border-radius: 8px; border: 1px solid #E5E5EA; background: #F2F2F7; font-size: 13px; outline: none; appearance: none; color: #1D1D1F; font-weight: 500; min-width: 0; }
      select { cursor: pointer; }
      select:focus, input.cat-search:focus { border-color: #007AFF; background: #fff; }
      button { padding: 8px 16px; border-radius: 20px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s; }
      .btn-skip { background: #F2F2F7; color: #86868B; }
      .btn-skip:hover { background: #E5E5EA; }
      .btn-confirm { background: #007AFF; color: white; box-shadow: 0 4px 12px rgba(0, 122, 255, 0.2); }
      .btn-confirm:hover { background: #0066CC; transform: translateY(-1px); }
      .btn-manual { background: #E5F1FF; color: #007AFF; }
      .btn-manual:hover { background: #CCE4FF; }
      .header { padding: 20px; border-bottom: 1px solid rgba(0,0,0,0.05); background: transparent; border-radius: 16px 16px 0 0; }
      .header h3 { margin: 0 0 4px 0; font-size: 18px; font-weight: 700; letter-spacing: -0.5px; color: #1D1D1F; }
      .header p { margin: 0; font-size: 14px; color: #86868B; }
      .footer { padding: 16px 20px; border-top: 1px solid rgba(0,0,0,0.05); background: transparent; border-radius: 0 0 16px 16px; display: flex; justify-content: space-between; }
      /* Category dropdown portal styles */
      .cat-item { display: flex; justify-content: space-between; align-items: center; padding: 9px 12px; font-size: 12px; cursor: pointer; border-bottom: 1px solid rgba(0,0,0,0.04); transition: background 0.1s; }
      .cat-item:last-child { border-bottom: none; }
      .cat-item:hover { background: #EAF3FF; }
      .cat-item.cat-selected { background: #E5F1FF; }
      .cat-name { font-weight: 600; color: #1D1D1F; }
      .cat-code { font-size: 10px; color: #AEAEB2; font-family: monospace; margin-left: 6px; }
      .cat-item.cat-match .cat-name { color: #007AFF; }
      .cat-item.cat-match .cat-code { color: #5AC8FA; }
    `;
    shadow.appendChild(style);

    // Portal dropdown — lives in shadow root, NOT inside panel, so it escapes overflow:hidden
    catDropdownPortal = document.createElement('div');
    catDropdownPortal.style.cssText = `
      position: fixed;
      background: rgba(255,255,255,0.97);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid #E5E5EA;
      border-radius: 10px;
      box-shadow: 0 8px 28px rgba(0,0,0,0.13);
      max-height: 200px;
      overflow-y: auto;
      z-index: 2;
      display: none;
      scrollbar-width: thin;
      pointer-events: all;
    `;
    shadow.appendChild(catDropdownPortal);

    window.addEventListener('scroll', redrawHighlights, { passive: true });
    window.addEventListener('resize', redrawHighlights, { passive: true });
  }

  function getStickyHeaderHeight() {
    const fixedElements = Array.from(document.querySelectorAll('*')).filter(el => {
      const style = window.getComputedStyle(el);
      if (style.position !== 'fixed' && style.position !== 'sticky') return false;
      const rect = el.getBoundingClientRect();
      return rect.top <= 5 && rect.height > 10 && rect.width > window.innerWidth * 0.5;
    });
    if (fixedElements.length === 0) return 0;
    return Math.max(...fixedElements.map(el => el.getBoundingClientRect().height));
  }

  let redrawPending = false;
  function redrawHighlights() {
    if (!shadow || panel.style.display === 'none') return;
    if (redrawPending) return;
    redrawPending = true;
    requestAnimationFrame(() => {
      drawHighlights(currentFields);
      redrawPending = false;
    });
  }

  function drawHighlights(fields) {
    if (!shadow) return;
    svgLayer.textContent = '';
    const headerHeight = getStickyHeaderHeight();

    fields.forEach(f => {
      if (!f.element) return;
      const rect = f.element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0 || rect.bottom < 0 || rect.top > window.innerHeight) return;
      
      const y = Math.max(headerHeight + 4, rect.top);
      let color = '#ccc';
      if (f.classification.confidenceBand === 'HIGH') color = '#4caf50';
      else if (f.classification.confidenceBand === 'MEDIUM') color = '#ff9800';
      else if (f.classification.confidenceBand === 'LOW' || f.classification.confidenceBand === 'UNKNOWN') color = '#f44336';
      
      if (f.classification.fillRoute === 'overlay_file') color = '#2196f3';
      if (f.classification.fillRoute === 'overlay_eeo') color = '#ff5722';

      const rectEl = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rectEl.setAttribute('x', rect.left - 2);
      rectEl.setAttribute('y', y - 2);
      rectEl.setAttribute('width', rect.width + 4);
      rectEl.setAttribute('height', Math.max(0, rect.bottom - y + 4));
      rectEl.setAttribute('fill', 'none');
      rectEl.setAttribute('stroke', color);
      rectEl.setAttribute('stroke-width', '2');
      rectEl.setAttribute('rx', '4');
      svgLayer.appendChild(rectEl);
    });
  }

  function adaptPanelPosition() {
    if (!shadow) return;
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      panel.style.bottom = '0';
      panel.style.left = '0';
      panel.style.width = '100%';
      panel.style.borderRadius = '12px 12px 0 0';
      panel.style.top = 'auto';
      panel.style.right = 'auto';
      return;
    }

    panel.style.width = '320px';
    panel.style.borderRadius = '16px';
    panel.style.bottom = '20px';
    panel.style.right = '20px';
    panel.style.top = 'auto';
    panel.style.left = 'auto';
    
    // Slide-in animation
    panel.animate([
      { transform: 'translateY(20px)', opacity: 0 },
      { transform: 'translateY(0)', opacity: 1 }
    ], { duration: 300, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
  }


  async function showReviewPanel(fieldsToReview, onConfirmCallback, onDismissCallback) {
    if (!shadow) {
      return false; 
    }
    currentFields = fieldsToReview;
    panel.textContent = '';
    
    const header = document.createElement('div');
    header.className = 'header';
    const h3 = document.createElement('h3'); h3.textContent = 'AutoFill Review';
    const pDesc = document.createElement('p'); pDesc.textContent = `${fieldsToReview.length} fields need your attention`;
    header.appendChild(h3);
    header.appendChild(pDesc);
    panel.appendChild(header);

    const list = document.createElement('div');
    list.className = 'list-container';
    
    const library = await new Promise(resolve => {
      try {
        chrome.runtime.sendMessage({ action: 'GET_FILE_LIBRARY' }, response => resolve(response || []));
      } catch (e) {
        console.warn("[AutoFill] Extension context invalidated in ShadowOverlay. Returning empty library.");
        resolve([]);
      }
    });

    fieldsToReview.forEach((f, idx) => {
      const row = document.createElement('div');
      row.className = 'review-row';
      
      let labelText = f.fieldMeta.ariaLabelledby || f.fieldMeta.labelText || f.fieldMeta.placeholder || f.fieldMeta.ariaLabel || 'Unnamed Field';
      if (labelText === 'Your answer' || labelText === 'Unnamed Field' || labelText.trim() === '') {
        labelText = f.fieldMeta.surroundingText || labelText;
      }
      if (labelText.length > 85) labelText = labelText.substring(0, 85) + '...';

      const previewDiv = document.createElement('div');
      previewDiv.className = 'label-preview';
      previewDiv.textContent = ` "${labelText}"`;
      
      const controlsWrapper = document.createElement('div');
      if (f.classification.fillRoute === 'overlay_file') {
        controlsWrapper.className = 'controls';
        const select = document.createElement('select'); select.id = `select-${idx}`;
        const optDefault = document.createElement('option'); optDefault.value = ''; optDefault.textContent = '-- Select File --';
        select.appendChild(optDefault);
        library.forEach(file => {
          const opt = document.createElement('option');
          opt.value = file.id; opt.textContent = file.originalFileName;
          if (file.isDefaultForType && file.typeTag === 'RESUME') opt.selected = true;
          select.appendChild(opt);
        });
        controlsWrapper.appendChild(select);
      } else {
        const suggDiv = document.createElement('div'); suggDiv.className = 'suggestion';
        suggDiv.textContent = `Suggestion: ${f.classification.assignedCategory} (${Math.round(f.classification.confidence * 100)}%)`;
        controlsWrapper.appendChild(suggDiv);
        
        // Searchable category input — uses custom portal dropdown (always shows all, sorted by relevance)
        const searchRow = document.createElement('div'); searchRow.className = 'controls'; searchRow.style.marginBottom = '8px';
        const input = document.createElement('input'); input.id = `select-cat-${idx}`;
        input.className = 'cat-search'; input.value = f.classification.assignedCategory; input.placeholder = 'Search category...';
        setTimeout(() => attachSearchableInput(input), 0);
        searchRow.appendChild(input);
        controlsWrapper.appendChild(searchRow);
        
        if (f.classification.fillRoute === 'overlay_eeo' || f.classification.fillRoute === 'overlay_cover_letter') {
          if (f.fieldMeta.tagName === 'TEXTAREA' || f.fieldMeta.inputType === 'contenteditable') {
            const flexDiv = document.createElement('div'); flexDiv.className = 'controls'; flexDiv.style.flexDirection = 'column'; flexDiv.style.gap = '8px';
            const aiInput = document.createElement('input'); aiInput.type = 'text'; aiInput.id = `ai-notes-${idx}`; aiInput.placeholder = 'Add notes for AI (optional)';
            aiInput.style.cssText = 'padding: 8px 12px; border-radius: 8px; border: 1px solid #E5E5EA; background: #F2F2F7; font-size: 13px; outline: none; width: calc(100% - 24px);';
            const btnRow = document.createElement('div'); btnRow.style.display = 'flex'; btnRow.style.gap = '8px';
            const btnAi = document.createElement('button'); btnAi.className = 'btn-confirm'; btnAi.id = `btn-ai-${idx}`; btnAi.textContent = '✨ Generate with AI'; btnAi.style.background = '#5E5CE6';
            const btnScroll = document.createElement('button'); btnScroll.className = 'btn-manual'; btnScroll.id = `btn-scroll-${idx}`; btnScroll.textContent = 'Scroll to field';
            btnRow.appendChild(btnAi); btnRow.appendChild(btnScroll);
            flexDiv.appendChild(aiInput); flexDiv.appendChild(btnRow);
            controlsWrapper.appendChild(flexDiv);
          } else {
            const btnRow = document.createElement('div'); btnRow.className = 'controls';
            const btnText = document.createElement('button'); btnText.className = 'btn-confirm'; btnText.id = `btn-text-${idx}`; btnText.textContent = 'Fill Data';
            const btnScroll = document.createElement('button'); btnScroll.className = 'btn-manual'; btnScroll.id = `btn-scroll-${idx}`; btnScroll.textContent = 'Scroll to field';
            btnRow.appendChild(btnText); btnRow.appendChild(btnScroll);
            controlsWrapper.appendChild(btnRow);
          }
        } else {
          // Plain overlay field: Accept Suggestion + Skip
          const innerControls = document.createElement('div'); innerControls.className = 'controls';
          const btnManual = document.createElement('button'); btnManual.className = 'btn-manual'; btnManual.id = `btn-text-${idx}`; btnManual.textContent = 'Accept Suggestion';
          const btnSkip = document.createElement('button'); btnSkip.className = 'btn-skip'; btnSkip.id = `btn-skip-${idx}`; btnSkip.textContent = 'Skip';
          innerControls.appendChild(btnManual);
          innerControls.appendChild(btnSkip);
          controlsWrapper.appendChild(innerControls);
        }
      }

      row.appendChild(previewDiv);
      row.appendChild(controlsWrapper);
      list.appendChild(row);

      setTimeout(() => {
        if (f.classification.fillRoute === 'overlay_eeo' || f.classification.fillRoute === 'overlay_cover_letter') {
          shadow.querySelector(`#btn-scroll-${idx}`)?.addEventListener('click', () => {
            f.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            f.element.focus();
          });
          shadow.querySelector(`#btn-text-${idx}`)?.addEventListener('click', () => {
            const select = shadow.querySelector(`#select-cat-${idx}`);
            if (select) resolveRow({ action: 'fill_text', field: f, category: select.value });
          });
          
          const btnAI = shadow.querySelector(`#btn-ai-${idx}`);
          if (btnAI) {
            btnAI.addEventListener('click', async () => {
              btnAI.innerText = 'Generating...';
              btnAI.disabled = true;
              const notes = shadow.querySelector(`#ai-notes-${idx}`).value;
              const profile = await globalThis.ProfileStore.getProfile();
              const questionText = f.fieldMeta.ariaLabelledby || f.fieldMeta.labelText || f.fieldMeta.placeholder || f.fieldMeta.surroundingText || 'Answer the question';
              
              chrome.runtime.sendMessage({
                action: 'GENERATE_ESSAY',
                profile: profile,
                question: questionText,
                notes: notes,
                globalInstructions: profile.preferences?.aiInstructions || ''
              }, (response) => {
                if (response.error) {
                  if (response.error === 'MISSING_API_KEY') {
                    showAPIErrorModal();
                  } else {
                    showAPIErrorModal('AI Error: ' + response.error);
                  }
                  btnAI.textContent = '✦ Generate with AI';
                  btnAI.disabled = false;
                } else {
                  f.element.value = response.text;
                  f.element.dispatchEvent(new Event('input', { bubbles: true }));
                  f.element.dispatchEvent(new Event('change', { bubbles: true }));
                  btnAI.textContent = '✓ Generated';
                  btnAI.style.background = '#34C759';
                  btnAI.disabled = false;
                }
              });
            });
          }
        } else if (f.classification.fillRoute !== 'overlay_file') {
          const skipBtn = shadow.querySelector(`#btn-skip-${idx}`);
          if (skipBtn) {
            skipBtn.addEventListener('click', () => {
              const select = shadow.querySelector(`#select-cat-${idx}`);
              if (select) select.setAttribute('data-skipped', 'true');
              skipBtn.innerText = 'Skipped';
              skipBtn.style.background = '#ccc';
              skipBtn.disabled = true;
            });
          }
          const acceptBtn = shadow.querySelector(`#btn-text-${idx}`);
          if (acceptBtn) {
            acceptBtn.addEventListener('click', () => {
              const select = shadow.querySelector(`#select-cat-${idx}`);
              if (select) {
                // Mark as accepted so Fill Confirmed picks it up
                select.setAttribute('data-accepted', 'true');
                acceptBtn.textContent = 'Accepted ✓';
                acceptBtn.style.background = '#34C759';
                acceptBtn.style.color = '#fff';
                acceptBtn.disabled = true;
              }
            });
          }
        }
      }, 0);
    });

    panel.appendChild(list);

    const footer = document.createElement('div');
    footer.className = 'footer';
    const btnDismiss = document.createElement('button'); btnDismiss.className = 'btn-skip'; btnDismiss.id = 'btn-dismiss'; btnDismiss.textContent = 'Dismiss';
    const btnConfirm = document.createElement('button'); btnConfirm.className = 'btn-confirm'; btnConfirm.id = 'btn-fill-all'; btnConfirm.textContent = 'Fill Confirmed';
    footer.appendChild(btnDismiss);
    footer.appendChild(btnConfirm);
    panel.appendChild(footer);

    panel.style.display = 'flex';
    adaptPanelPosition();
    drawHighlights(fieldsToReview);

    shadow.querySelector('#btn-dismiss').addEventListener('click', () => {
      hidePanel();
      if (onDismissCallback) onDismissCallback();
    });

    shadow.querySelector('#btn-fill-all').addEventListener('click', () => {
      const decisions = fieldsToReview.map((f, idx) => {
        if (f.classification.fillRoute === 'overlay_file') {
          const select = shadow.querySelector(`#select-${idx}`);
          return { field: f, action: select.value ? 'fill_file' : 'skip', fileId: select.value };
        } else {
          const select = shadow.querySelector(`#select-cat-${idx}`);
          if (select && (select.hasAttribute('data-skipped') || select.value === 'UNKNOWN')) {
            return { field: f, action: 'skip' };
          } else if (select) {
            return { field: f, action: 'fill_text', category: select.value };
          } else {
            return { field: f, action: 'skip' };
          }
        }
      });
      hidePanel();
      if (onConfirmCallback) onConfirmCallback(decisions);
      // Re-inject the floating widget after confirming, same as dismiss
      if (onDismissCallback) onDismissCallback();
    });
    
    return true; 
  }

  function hidePanel() {
    if (panel) panel.style.display = 'none';
    if (svgLayer) svgLayer.textContent = '';
  }

  function showAPIErrorModal(errorMessage = 'To use AI generation, please configure your AI Provider and API Key in the Settings -> Privacy tab.') {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(255,255,255,0.9); backdrop-filter: blur(4px);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      border-radius: 16px; z-index: 100; text-align: center; padding: 24px;
    `;
    const container = document.createElement('div');
    container.style.marginBottom = '12px';
    // We cannot use innerHTML for SVG. We will just use an emoji.
    container.textContent = '⚠️';
    container.style.fontSize = '32px';
    const h3 = document.createElement('h3');
    h3.style.cssText = 'margin: 0 0 8px 0; color: #1D1D1F; font-size: 16px;';
    h3.textContent = 'API Key Required';
    const p = document.createElement('p');
    p.style.cssText = 'margin: 0 0 16px 0; color: #86868B; font-size: 13px; line-height: 1.4;';
    p.textContent = errorMessage;
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; gap: 8px; width: 100%;';
    const btnClose = document.createElement('button');
    btnClose.id = 'btn-err-close'; btnClose.textContent = 'Close';
    btnClose.style.cssText = 'flex: 1; padding: 8px; background: #E5E5EA; color: #1D1D1F; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;';
    const btnSettings = document.createElement('button');
    btnSettings.id = 'btn-err-settings'; btnSettings.textContent = 'Open Settings';
    btnSettings.style.cssText = 'flex: 1; padding: 8px; background: #007AFF; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;';
    btnRow.appendChild(btnClose); btnRow.appendChild(btnSettings);
    modal.appendChild(container); modal.appendChild(h3); modal.appendChild(p); modal.appendChild(btnRow);
    panel.appendChild(modal);
    modal.querySelector('#btn-err-close').addEventListener('click', () => modal.remove());
    modal.querySelector('#btn-err-settings').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'OPEN_SETTINGS' });
      modal.remove();
    });
  }

  function isFallbackMode() {
    return shadow === null;
  }

  return { init, showReviewPanel, hidePanel, isFallbackMode };
})();
