globalThis.FieldExtractor = (function() {
  function getDomPath(el) {
    const stack = [];
    while (el.parentNode != null) {
      let sibCount = 0;
      let sibIndex = 0;
      for (let i = 0; i < el.parentNode.childNodes.length; i++) {
        const sib = el.parentNode.childNodes[i];
        if (sib.nodeName === el.nodeName) {
          if (sib === el) sibIndex = sibCount;
          sibCount++;
        }
      }
      if (el.hasAttribute('id') && el.id !== '') {
        stack.unshift(el.nodeName.toLowerCase() + '#' + el.id);
      } else if (sibCount > 1) {
        stack.unshift(el.nodeName.toLowerCase() + ':eq(' + sibIndex + ')');
      } else {
        stack.unshift(el.nodeName.toLowerCase());
      }
      el = el.parentNode;
    }
    return stack.join(' > ');
  }

  async function hash(str) {
    const msgUint8 = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-1', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function getLabelText(element) {
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) return label.innerText;
    }
    const parentLabel = element.closest('label');
    if (parentLabel) return parentLabel.innerText;
    return '';
  }

  function getAriaLabelledbyText(element) {
    const refs = [element.getAttribute('aria-labelledby'), element.getAttribute('aria-describedby')]
      .filter(Boolean)
      .join(' ')
      .split(/\s+/)
      .filter(Boolean);
      
    if (refs.length > 0) {
      return refs.map(id => {
        const el = document.getElementById(id);
        return el ? el.innerText || el.textContent : '';
      }).join(' ').replace(/\s+/g, ' ').trim();
    }
    return '';
  }

  function getSurroundingText(element) {
    let textChunks = [];
    
    // 1. Check parent hierarchy's innerText (this usually captures the MS Forms wrapper)
    let parent = element.parentElement;
    for (let i = 0; i < 4 && parent && parent.tagName !== 'BODY'; i++) {
      const text = (parent.innerText || parent.textContent || '').replace(/\s+/g, ' ').trim();
      const valText = (element.value || '').trim();
      if (text.length > 0 && (!valText || text !== valText)) {
        textChunks.push(text);
        break; // found the closest enclosing text
      }
      parent = parent.parentElement;
    }

    // 2. Explicitly check previous siblings of the element and its parents
    // (Helps with highly disconnected DOMs where the label is entirely outside the input wrapper)
    let current = element;
    for (let i = 0; i < 4 && current && current.tagName !== 'BODY'; i++) {
      let prev = current.previousElementSibling;
      while (prev) {
         const text = (prev.innerText || prev.textContent || '').replace(/\s+/g, ' ').trim();
         if (text.length > 0 && !textChunks.includes(text)) {
           textChunks.push(text);
         }
         prev = prev.previousElementSibling;
      }
      current = current.parentElement;
    }

    return textChunks.join(' ');
  }

  function getFieldsetLegend(element) {
    const fieldset = element.closest('fieldset');
    if (fieldset) {
      const legend = fieldset.querySelector('legend');
      if (legend) return legend.innerText;
    }
    return '';
  }
  
  function getDataAttributes(element) {
    const data = {};
    for (const attr of element.attributes) {
      if (attr.name.startsWith('data-')) {
        data[attr.name] = attr.value;
      }
    }
    return data;
  }

  async function extractField(element) {
    const domPath = getDomPath(element);
    const tagName = element.tagName.toUpperCase();
    const name = element.name || '';
    const id = element.id || '';
    const placeholder = element.placeholder || '';
    const autocomplete = element.autocomplete || '';
    
    let inputType = element.type || '';
    if (element.getAttribute('role') === 'textbox') inputType = 'aria-textbox';
    if (element.getAttribute('role') === 'combobox') inputType = 'aria-combobox';
    if (element.getAttribute('contenteditable') === 'true') inputType = 'contenteditable';

    const rawStringForHash = tagName + name + id + placeholder + domPath;
    const fingerprint = await hash(rawStringForHash);

    const ariaLabel = element.getAttribute('aria-label') || '';
    const ariaLabelledby = getAriaLabelledbyText(element);
    const ariaPlaceholder = element.getAttribute('aria-placeholder') || '';
    const labelText = getLabelText(element);
    const surroundingText = getSurroundingText(element);
    const fieldsetLegend = getFieldsetLegend(element);
    const dataAttributes = getDataAttributes(element);

    const rawTextItems = [
      labelText, ariaLabel, ariaLabelledby, placeholder, ariaPlaceholder,
      name, id, autocomplete, surroundingText, fieldsetLegend
    ];
    
    Object.keys(dataAttributes).forEach(key => {
      if (key.includes('label') || key.includes('name') || key.includes('field')) {
        rawTextItems.push(dataAttributes[key]);
      }
    });

    const combinedText = rawTextItems.filter(Boolean).join(' ').toLowerCase()
      .replace(/[^\w\s\u0600-\u06FF]/g, ' ')
      .replace(/\s+/g, ' ').trim();
      
    const hasArabic = /[\u0600-\u06FF]/.test(combinedText);
    const hasEnglish = /[a-z]/i.test(combinedText);
    
    let detectedLanguage = "unknown";
    if (hasArabic && hasEnglish) detectedLanguage = "mixed";
    else if (hasArabic) detectedLanguage = "ar";
    else if (hasEnglish) detectedLanguage = "en";

    return {
      fingerprint, tagName, inputType, name, id, placeholder, autocomplete,
      ariaLabel, ariaLabelledby, ariaPlaceholder, labelText, surroundingText,
      fieldsetLegend, dataAttributes, combinedText, domPath,
      detectedLanguage,
      pageUrl: window.location.hostname,
      detectedAt: new Date().toISOString(),
      element 
    };
  }

  function pierceShadowDOM(root, elements = []) {
    const selector = 'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]):not([type=checkbox]), textarea, select, [role="textbox"], [role="combobox"], [contenteditable="true"], [role="radiogroup"]';
    
    // Find matching elements in the current root
    const matches = root.querySelectorAll(selector);
    matches.forEach(el => elements.push(el));

    // Recursively search children for shadow roots
    const allNodes = root.querySelectorAll('*');
    for (const node of allNodes) {
      if (node.shadowRoot) {
        pierceShadowDOM(node.shadowRoot, elements);
      }
    }
    
    return elements;
  }

  async function scanFormFields(rootNode = document) {
    const fields = pierceShadowDOM(rootNode);
    
    const extracted = [];
    const processedElements = new Set();

    // First pass: Group radio buttons by name OR by closest shared container
    const allRadios = fields.filter(f => f.type === 'radio' || (f.getAttribute && f.getAttribute('role') === 'radio'));
    const radioGroupsByContainer = new Map();
    const radioGroupsByName = new Map();

    for (const radio of allRadios) {
      const sharedByName = radio.name ? allRadios.filter(r => r.name === radio.name) : [];
      if (sharedByName.length > 1) {
        if (!radioGroupsByName.has(radio.name)) radioGroupsByName.set(radio.name, []);
        if (!radioGroupsByName.get(radio.name).includes(radio)) {
           radioGroupsByName.get(radio.name).push(radio);
        }
      } else {
        // Group by closest parent that contains multiple radios (usually the question wrapper or options list)
        // Walk up to find a suitable container (up to 4 levels)
        let container = radio.parentElement;
        for (let i = 0; i < 4 && container; i++) {
           const radiosInContainer = container.querySelectorAll('input[type="radio"], [role="radio"]');
           if (radiosInContainer.length > 1) break;
           container = container.parentElement;
        }
        if (container) {
          if (!radioGroupsByContainer.has(container)) radioGroupsByContainer.set(container, []);
          radioGroupsByContainer.get(container).push(radio);
        } else {
          // Fallback if no container found
          if (!radioGroupsByContainer.has(radio)) radioGroupsByContainer.set(radio, []);
          radioGroupsByContainer.get(radio).push(radio);
        }
      }
    }

    // Process named radio groups
    for (const [name, group] of radioGroupsByName.entries()) {
      group.forEach(r => processedElements.add(r));
      if (group.length > 0) {
        const baseField = await extractField(group[0]);
        baseField.inputType = 'radio-group';
        baseField.radioElements = group;
        const allLabels = group.map(r => getLabelText(r) || r.innerText || r.getAttribute('aria-label') || r.value || '');
        baseField.combinedText = (baseField.combinedText + ' ' + allLabels.join(' ')).toLowerCase().replace(/[^\w\s\u0600-\u06FF]/g, ' ').replace(/\s+/g, ' ').trim();
        extracted.push(baseField);
      }
    }

    // Process container-based radio groups
    for (const [container, group] of radioGroupsByContainer.entries()) {
      group.forEach(r => processedElements.add(r));
      if (group.length > 0) {
        // Use the container to extract surrounding text to get the question title
        const baseField = await extractField(group[0]);
        baseField.inputType = 'radio-group';
        baseField.radioElements = group;
        const allLabels = group.map(r => getLabelText(r) || r.innerText || r.getAttribute('aria-label') || r.value || '');
        baseField.combinedText = (baseField.combinedText + ' ' + allLabels.join(' ')).toLowerCase().replace(/[^\w\s\u0600-\u06FF]/g, ' ').replace(/\s+/g, ' ').trim();
        extracted.push(baseField);
      }
    }

    for (const field of fields) {
      if (processedElements.has(field)) continue;

      // Skip fields that are children of a radiogroup, as they are handled by the radiogroup itself
      const radiogroupParent = field.closest && field.closest('[role="radiogroup"], [role="group"]');
      if (radiogroupParent && radiogroupParent !== field) {
        continue;
      }

      if (field.getAttribute && (field.getAttribute('role') === 'radiogroup' || field.getAttribute('role') === 'group')) {
        const radios = Array.from(field.querySelectorAll('[role="radio"], input[type="radio"]'));
        if (radios.length === 0) continue; // Not a radiogroup if it has no radios
        radios.forEach(r => processedElements.add(r));
        const baseField = await extractField(field);
        baseField.inputType = 'radio-group';
        baseField.radioElements = radios;
        const allLabels = radios.map(r => r.innerText || r.getAttribute('aria-label') || r.value || '');
        baseField.combinedText = (baseField.combinedText + ' ' + allLabels.join(' ')).toLowerCase().replace(/[^\w\s\u0600-\u06FF]/g, ' ').replace(/\s+/g, ' ').trim();
        extracted.push(baseField);
      } else {
        extracted.push(await extractField(field));
      }
    }
    return extracted;
  }

  return { extractField, scanFormFields };
})();
