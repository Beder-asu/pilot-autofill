globalThis.FieldExtractor = (function () {

  // ---------------------------------------------------------------------------
  // UTILITIES
  // ---------------------------------------------------------------------------

  async function hash(str) {
    const msgUint8 = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-1', msgUint8);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  function getDomPath(el) {
    const stack = [];
    while (el && el.parentNode) {
      let sibCount = 0, sibIndex = 0;
      for (let i = 0; i < el.parentNode.childNodes.length; i++) {
        const sib = el.parentNode.childNodes[i];
        if (sib.nodeName === el.nodeName) {
          if (sib === el) sibIndex = sibCount;
          sibCount++;
        }
      }
      if (el.id) stack.unshift(el.nodeName.toLowerCase() + '#' + el.id);
      else if (sibCount > 1) stack.unshift(el.nodeName.toLowerCase() + ':eq(' + sibIndex + ')');
      else stack.unshift(el.nodeName.toLowerCase());
      el = el.parentNode;
    }
    return stack.join(' > ');
  }

  function cleanText(str) {
    return (str || '').replace(/\s+/g, ' ').trim();
  }

  function normalise(str) {
    return cleanText(str).toLowerCase()
      .replace(/[^\w\s\u0600-\u06FF]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  function getDataAttributes(element) {
    const data = {};
    if (!element.attributes) return data;
    for (const attr of element.attributes) {
      if (attr.name.startsWith('data-')) data[attr.name] = attr.value;
    }
    return data;
  }

  // ---------------------------------------------------------------------------
  // QUESTION TITLE EXTRACTION
  // Extract the human-readable label for a form question from its container.
  // Priority: aria-labelledby → legend → role=heading → first meaningful text node
  // ---------------------------------------------------------------------------

  function extractQuestionTitle(container) {
    // 1. aria-labelledby on the container itself
    const labelledby = container.getAttribute && container.getAttribute('aria-labelledby');
    if (labelledby) {
      const parts = labelledby.split(/\s+/).map(id => {
        const el = document.getElementById(id);
        return el ? cleanText(el.innerText || el.textContent) : '';
      }).filter(Boolean);
      if (parts.length) return parts.join(' ');
    }

    // 2. aria-label on the container itself
    const ariaLabel = container.getAttribute && container.getAttribute('aria-label');
    if (ariaLabel) return cleanText(ariaLabel);

    // 3. <legend> in a <fieldset>
    const legend = container.querySelector && container.querySelector('legend');
    if (legend) return cleanText(legend.innerText || legend.textContent);

    // 4. role=heading element inside the container
    const heading = container.querySelector && container.querySelector('[role="heading"], h1, h2, h3, h4, h5, h6');
    if (heading) return cleanText(heading.innerText || heading.textContent);

    // 5. Walk the direct children looking for a text-rich non-input node
    if (container.children) {
      for (const child of container.children) {
        const tag = child.tagName && child.tagName.toUpperCase();
        if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tag)) continue;
        const t = cleanText(child.innerText || child.textContent);
        if (t.length > 2) return t;
      }
    }

    // 6. fallback: full innerText of container (truncated)
    const full = cleanText(container.innerText || container.textContent);
    return full.slice(0, 120);
  }

  // ---------------------------------------------------------------------------
  // INPUT CATEGORISATION
  // Given a container, find all interactive inputs and classify their type.
  // Returns { inputType, primaryElement, allElements, options }
  // ---------------------------------------------------------------------------

  function categorizeInputs(container) {
    const all = Array.from(
      container.querySelectorAll(
        'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]),' +
        'textarea, select,' +
        '[role="textbox"], [role="combobox"], [role="listbox"],' +
        '[contenteditable="true"],' +
        '[role="radio"], [role="checkbox"]'
      )
    );

    if (all.length === 0) return null;

    // Detect file inputs first (highest specificity)
    const fileInput = all.find(el => el.type === 'file');
    if (fileInput) return { inputType: 'file', primaryElement: fileInput, allElements: [fileInput], options: [] };

    // Radio group (native or ARIA)
    const radios = all.filter(el => el.type === 'radio' || el.getAttribute('role') === 'radio');
    if (radios.length > 0) {
      const options = radios.map(r => {
        // Prefer the associated label text, then aria-label, then value
        const lbl = _getLabelFor(r);
        return lbl || r.getAttribute('aria-label') || r.value || '';
      }).filter(Boolean);
      return { inputType: 'radio-group', primaryElement: radios[0], allElements: radios, options };
    }

    // Checkbox group (multiple checkboxes → multi-select)
    const checkboxes = all.filter(el => el.type === 'checkbox' || el.getAttribute('role') === 'checkbox');
    if (checkboxes.length > 1) {
      const options = checkboxes.map(cb => {
        const lbl = _getLabelFor(cb);
        return lbl || cb.getAttribute('aria-label') || cb.value || '';
      }).filter(Boolean);
      return { inputType: 'checkbox-group', primaryElement: checkboxes[0], allElements: checkboxes, options };
    }

    // Native <select>
    const select = all.find(el => el.tagName === 'SELECT');
    if (select) {
      const options = Array.from(select.options).map(o => o.text).filter(Boolean);
      return { inputType: 'select', primaryElement: select, allElements: [select], options };
    }

    // ARIA combobox / listbox
    const combobox = all.find(el => el.getAttribute('role') === 'combobox' || el.getAttribute('role') === 'listbox');
    if (combobox) return { inputType: 'aria-combobox', primaryElement: combobox, allElements: [combobox], options: [] };

    // Textarea / contenteditable
    const textarea = all.find(el => el.tagName === 'TEXTAREA' || el.getAttribute('contenteditable') === 'true');
    if (textarea) {
      return {
        inputType: textarea.tagName === 'TEXTAREA' ? 'textarea' : 'contenteditable',
        primaryElement: textarea, allElements: [textarea], options: []
      };
    }

    // Single text-like input
    const textInput = all[0];
    let inputType = textInput.type || 'text';
    if (textInput.getAttribute('role') === 'textbox') inputType = 'aria-textbox';
    return { inputType, primaryElement: textInput, allElements: [textInput], options: [] };
  }

  function _getLabelFor(el) {
    // Check explicit label[for=id]
    if (el.id) {
      const lbl = document.querySelector(`label[for="${el.id}"]`);
      if (lbl) return cleanText(lbl.innerText || lbl.textContent);
    }
    // Check wrapping label
    const parent = el.closest('label');
    if (parent) return cleanText(parent.innerText || parent.textContent);
    // Check aria-labelledby
    const lblId = el.getAttribute('aria-labelledby');
    if (lblId) {
      const refEl = document.getElementById(lblId);
      if (refEl) return cleanText(refEl.innerText || refEl.textContent);
    }
    // Check aria-label
    return cleanText(el.getAttribute('aria-label') || '');
  }

  // ---------------------------------------------------------------------------
  // QUESTION CONTAINER DETECTION
  // Find the wrapper elements that each represent one form question.
  // Strategy: walk the DOM tree, collecting nodes that contain BOTH a visible
  // label/title AND one or more inputs (without nesting inside another question).
  // ---------------------------------------------------------------------------

  /**
   * Given a root DOM node, find all "question container" elements.
   * A question container is the smallest ancestor that wraps both:
   *   - at least one interactive input (text, radio, file, etc.)
   *   - at least one visible text label (title of the question)
   *
   * We use a top-down approach: we walk children, and as soon as we find a
   * container that has inputs, we stop recursing into it (to avoid double-
   * counting option rows as separate questions).
   */
  function findQuestionContainers(root) {
    const containers = [];
    _walkForContainers(root, containers, new Set());
    return containers;
  }

  function _walkForContainers(node, containers, visitedContainers) {
    if (!node || !node.children) return;

    for (const child of node.children) {
      // Skip invisible and utility elements
      const tag = child.tagName && child.tagName.toUpperCase();
      if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'META', 'HEAD'].includes(tag)) continue;

      // Check if this node qualifies as a question container
      if (_isQuestionContainer(child)) {
        containers.push(child);
        // Don't recurse into it — its contents belong to this question
        continue;
      }

      // If the child has a shadow root, pierce it
      if (child.shadowRoot) {
        _walkForContainers(child.shadowRoot, containers, visitedContainers);
      }

      // Recurse deeper
      _walkForContainers(child, containers, visitedContainers);
    }
  }

  function _isQuestionContainer(el) {
    // Must have interactive inputs inside
    const inputs = el.querySelectorAll(
      'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]),' +
      'textarea, select, [role="textbox"], [role="combobox"], [role="radio"], [role="checkbox"], [contenteditable="true"]'
    );
    if (inputs.length === 0) return false;

    // Must have some visible label text that is NOT just the input's own placeholder/value
    const title = extractQuestionTitle(el);
    if (!title || title.length < 2) return false;

    // Avoid matching the entire <form> or <body> or very large wrappers
    // (heuristic: if the container has more than 15 inputs, it's likely a page section, not a question)
    if (inputs.length > 15) return false;

    // Avoid matching individual radio option rows
    // (a question container should have a title that is different from all its input values)
    if (inputs.length === 1 && (inputs[0].type === 'radio' || inputs[0].getAttribute('role') === 'radio')) {
      // A single radio button is an option, not a question
      return false;
    }

    // Avoid matching individual checkbox rows similarly
    if (inputs.length === 1 && (inputs[0].type === 'checkbox' || inputs[0].getAttribute('role') === 'checkbox')) {
      return false;
    }

    return true;
  }

  // ---------------------------------------------------------------------------
  // FALLBACK: INPUT-FIRST SCAN
  // For pages that don't fit the question-container model (e.g. plain HTML forms
  // with simple field-by-field layout), we fall back to the original approach
  // of finding inputs and extracting their metadata directly.
  // ---------------------------------------------------------------------------

  function _fallbackScan(root) {
    const selector =
      'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]):not([type=radio]):not([type=checkbox]),' +
      'textarea, select,' +
      '[role="textbox"], [role="combobox"],' +
      '[contenteditable="true"]';

    const inputs = Array.from(root.querySelectorAll(selector));

    // Also pierce shadow roots
    const allNodes = root.querySelectorAll('*');
    for (const node of allNodes) {
      if (node.shadowRoot) {
        const shadowInputs = node.shadowRoot.querySelectorAll(selector);
        inputs.push(...shadowInputs);
      }
    }

    // Additionally handle radio groups
    const allRadios = Array.from(root.querySelectorAll('input[type="radio"], [role="radio"]'));
    const processedRadioContainers = new Set();
    const radioGroupInputs = [];

    for (const radio of allRadios) {
      // Walk up to find the container that groups these radios
      let container = radio.parentElement;
      for (let i = 0; i < 6 && container && container.tagName !== 'BODY'; i++) {
        if (processedRadioContainers.has(container)) break;
        const radiosInside = container.querySelectorAll('input[type="radio"], [role="radio"]');
        if (radiosInside.length > 1) {
          processedRadioContainers.add(container);
          radioGroupInputs.push({ container, radios: Array.from(radiosInside) });
          break;
        }
        container = container.parentElement;
      }
    }

    return { singleInputs: inputs, radioGroups: radioGroupInputs };
  }

  // ---------------------------------------------------------------------------
  // FIELD MODEL BUILDER
  // Converts a question container (or a fallback input) into a FieldModel.
  // The FieldModel output is API-compatible with the old extractField() output,
  // so classifier.js and autofill-engine.js need zero changes.
  // ---------------------------------------------------------------------------

  async function buildFieldModelFromContainer(container) {
    const inputInfo = categorizeInputs(container);
    if (!inputInfo) return null;

    const { inputType, primaryElement, allElements, options } = inputInfo;
    const questionTitle = extractQuestionTitle(container);

    const el = primaryElement;
    const name = el.name || '';
    const id = el.id || '';
    const placeholder = el.placeholder || '';
    const autocomplete = el.autocomplete || '';
    const ariaLabel = el.getAttribute('aria-label') || '';
    const dataAttributes = getDataAttributes(el);

    const domPath = getDomPath(el);
    const rawStringForHash = questionTitle + name + id + domPath;
    const fingerprint = await hash(rawStringForHash);

    // Build combined text from the question title + option labels (for classifier)
    const optionsText = options.join(' ');
    const combinedRaw = [questionTitle, ariaLabel, placeholder, autocomplete, name, id, optionsText,
      ...Object.values(dataAttributes)].filter(Boolean).join(' ');
    const combinedText = normalise(combinedRaw);

    const hasArabic = /[\u0600-\u06FF]/.test(combinedText);
    const hasEnglish = /[a-z]/i.test(combinedText);
    let detectedLanguage = 'unknown';
    if (hasArabic && hasEnglish) detectedLanguage = 'mixed';
    else if (hasArabic) detectedLanguage = 'ar';
    else if (hasEnglish) detectedLanguage = 'en';

    return {
      fingerprint,
      tagName: el.tagName,
      inputType,
      name,
      id,
      placeholder,
      autocomplete,
      ariaLabel,
      ariaLabelledby: container.getAttribute ? (container.getAttribute('aria-labelledby') || '') : '',
      ariaPlaceholder: el.getAttribute('aria-placeholder') || '',
      labelText: questionTitle,      // The question title IS the label
      surroundingText: questionTitle, // For backward-compat with classifier sources
      fieldsetLegend: '',
      dataAttributes,
      combinedText,
      domPath,
      detectedLanguage,
      pageUrl: window.location.hostname,
      detectedAt: new Date().toISOString(),
      // Multi-element fields (radio groups, checkbox groups)
      element: el,                   // primary element for autofill engine
      radioElements: inputType === 'radio-group' || inputType === 'checkbox-group' ? allElements : undefined,
      options: options.length ? options : undefined,
    };
  }

  async function buildFieldModelFromInput(el, radioGroup = null) {
    const tagName = el.tagName.toUpperCase();
    const name = el.name || '';
    const id = el.id || '';
    const placeholder = el.placeholder || '';
    const autocomplete = el.autocomplete || '';

    let inputType = el.type || 'text';
    if (el.getAttribute('role') === 'textbox') inputType = 'aria-textbox';
    if (el.getAttribute('role') === 'combobox') inputType = 'aria-combobox';
    if (el.getAttribute('contenteditable') === 'true') inputType = 'contenteditable';

    const ariaLabel = el.getAttribute('aria-label') || '';
    const labelText = _getLabelFor(el);
    const dataAttributes = getDataAttributes(el);

    // Surrounding text: walk up and back through siblings (original Phase 2 logic)
    let surroundingParts = [];
    let cur = el;
    for (let i = 0; i < 4 && cur && cur.tagName !== 'BODY'; i++) {
      let prev = cur.previousElementSibling;
      while (prev) {
        const t = cleanText(prev.innerText || prev.textContent);
        if (t.length > 0 && !surroundingParts.includes(t)) surroundingParts.push(t);
        prev = prev.previousElementSibling;
      }
      cur = cur.parentElement;
    }
    const surroundingText = surroundingParts.join(' ');

    const options = radioGroup
      ? radioGroup.radios.map(r => _getLabelFor(r) || r.getAttribute('aria-label') || r.value || '').filter(Boolean)
      : [];

    const allElements = radioGroup ? radioGroup.radios : [el];
    if (radioGroup) inputType = 'radio-group';

    const domPath = getDomPath(el);
    const rawStringForHash = tagName + name + id + placeholder + domPath;
    const fingerprint = await hash(rawStringForHash);

    const combinedRaw = [labelText, ariaLabel, placeholder, autocomplete, name, id, surroundingText, options.join(' '),
      ...Object.values(dataAttributes)].filter(Boolean).join(' ');
    const combinedText = normalise(combinedRaw);

    const hasArabic = /[\u0600-\u06FF]/.test(combinedText);
    const hasEnglish = /[a-z]/i.test(combinedText);
    let detectedLanguage = 'unknown';
    if (hasArabic && hasEnglish) detectedLanguage = 'mixed';
    else if (hasArabic) detectedLanguage = 'ar';
    else if (hasEnglish) detectedLanguage = 'en';

    return {
      fingerprint, tagName, inputType, name, id, placeholder, autocomplete,
      ariaLabel, ariaLabelledby: '', ariaPlaceholder: el.getAttribute('aria-placeholder') || '',
      labelText, surroundingText, fieldsetLegend: '', dataAttributes, combinedText,
      domPath, detectedLanguage,
      pageUrl: window.location.hostname,
      detectedAt: new Date().toISOString(),
      element: el,
      radioElements: allElements.length > 1 ? allElements : undefined,
      options: options.length ? options : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // MAIN ENTRY POINT
  // ---------------------------------------------------------------------------

  async function scanFormFields(rootNode = document) {
    // Phase 1: Try question-first approach
    const questionContainers = findQuestionContainers(rootNode);

    if (questionContainers.length > 0) {
      // Question-first path: each container → one FieldModel
      const models = [];
      const seen = new Set();

      for (const container of questionContainers) {
        const model = await buildFieldModelFromContainer(container);
        if (!model) continue;
        // Deduplicate by fingerprint
        if (seen.has(model.fingerprint)) continue;
        seen.add(model.fingerprint);
        models.push(model);
      }

      if (models.length > 0) {
        console.log(`[AutoFill] Question-first scan: ${models.length} questions found.`);
        return models;
      }
    }

    // Phase 2: Fallback to input-first scan (plain HTML forms)
    console.log('[AutoFill] Falling back to input-first scan.');
    const { singleInputs, radioGroups } = _fallbackScan(rootNode);

    const models = [];
    const processedElements = new Set();

    // Add radio groups first
    for (const rg of radioGroups) {
      rg.radios.forEach(r => processedElements.add(r));
      const model = await buildFieldModelFromInput(rg.radios[0], rg);
      if (model) models.push(model);
    }

    // Add remaining single inputs
    for (const el of singleInputs) {
      if (processedElements.has(el)) continue;
      processedElements.add(el);
      const model = await buildFieldModelFromInput(el);
      if (model) models.push(model);
    }

    console.log(`[AutoFill] Input-first scan: ${models.length} fields found.`);
    return models;
  }

  // Kept for backward compatibility (used by autofill-engine in some edge paths)
  async function extractField(element) {
    return buildFieldModelFromInput(element);
  }

  return { extractField, scanFormFields };
})();
