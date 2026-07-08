globalThis.ParserUtils = (function() {
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
      if (label) {
         const text = label.innerText || label.textContent;
         if (text && text.trim()) return text.trim();
      }
    }
    const parentLabel = element.closest('label');
    if (parentLabel) {
       const text = parentLabel.innerText || parentLabel.textContent;
       if (text && text.trim()) return text.trim();
    }
    
    // Fallback for custom radio options (e.g., MS Forms) without a <label> tag
    if (element.type === 'radio' || element.type === 'checkbox' || 
        (element.getAttribute && (element.getAttribute('role') === 'radio' || element.getAttribute('role') === 'checkbox'))) {
       let current = element.parentElement;
       for (let i = 0; i < 3 && current && current.tagName !== 'BODY'; i++) {
          const radiosInCurrent = current.querySelectorAll('input[type="radio"], [role="radio"], input[type="checkbox"], [role="checkbox"]');
          if (radiosInCurrent.length === 1) {
             const text = current.innerText || current.textContent;
             if (text && text.trim()) return text.trim();
          }
          current = current.parentElement;
       }
    }
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
    for (const attr of element.attributes || []) {
      if (attr.name.startsWith('data-')) {
        data[attr.name] = attr.value;
      }
    }
    return data;
  }

  async function buildFieldModel(element, options = {}) {
    const domPath = getDomPath(element);
    const tagName = element.tagName ? element.tagName.toUpperCase() : '';
    const name = element.name || '';
    const id = element.id || '';
    const placeholder = element.placeholder || '';
    const autocomplete = element.autocomplete || '';
    
    let inputType = options.inputType || element.type || '';
    if (element.getAttribute && element.getAttribute('role') === 'textbox') inputType = 'aria-textbox';
    if (element.getAttribute && element.getAttribute('role') === 'combobox') inputType = 'aria-combobox';
    if (element.getAttribute && element.getAttribute('contenteditable') === 'true') inputType = 'contenteditable';

    const rawStringForHash = tagName + name + id + placeholder + domPath;
    const fingerprint = await hash(rawStringForHash);

    const ariaLabel = element.getAttribute ? element.getAttribute('aria-label') || '' : '';
    const ariaLabelledby = element.getAttribute ? getAriaLabelledbyText(element) : '';
    const ariaPlaceholder = element.getAttribute ? element.getAttribute('aria-placeholder') || '' : '';
    
    const labelText = options.labelText || getLabelText(element);
    const surroundingText = options.surroundingText || getSurroundingText(element);
    const fieldsetLegend = options.fieldsetLegend || getFieldsetLegend(element);
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
      pageUrl: window.location ? window.location.hostname : '',
      detectedAt: new Date().toISOString(),
      element,
      radioElements: options.radioElements || undefined,
      options: options.optionLabels || undefined,
      otherTextInput: options.otherTextInput || undefined
    };
  }

  function pierceShadowDOM(root, elements = [], selector) {
    const matches = root.querySelectorAll(selector);
    matches.forEach(el => elements.push(el));
    const allNodes = root.querySelectorAll('*');
    for (const node of allNodes) {
      if (node.shadowRoot) {
        pierceShadowDOM(node.shadowRoot, elements, selector);
      }
    }
    return elements;
  }

  return { 
    getDomPath, hash, getLabelText, getAriaLabelledbyText, getSurroundingText, 
    getFieldsetLegend, getDataAttributes, buildFieldModel, pierceShadowDOM 
  };
})();
