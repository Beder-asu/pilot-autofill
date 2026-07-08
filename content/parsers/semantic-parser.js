globalThis.SemanticParser = (function() {
  const { buildFieldModel, pierceShadowDOM } = globalThis.ParserUtils;

  async function scanFormFields(rootNode = document, processedElements = new Set()) {
    const extracted = [];
    const selector = 'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]):not([type=checkbox]), textarea, select, [role="textbox"], [role="combobox"], [contenteditable="true"]';
    
    const fields = pierceShadowDOM(rootNode, [], selector);
    
    // Group by name
    const allRadios = fields.filter(f => f.type === 'radio' || (f.getAttribute && f.getAttribute('role') === 'radio') || f.type === 'checkbox' || (f.getAttribute && f.getAttribute('role') === 'checkbox'));
    const namedGroups = new Map();

    for (const radio of allRadios) {
      if (radio.name) {
        if (!namedGroups.has(radio.name)) namedGroups.set(radio.name, []);
        namedGroups.get(radio.name).push(radio);
      } else {
        // Fallback: group by nearest common ancestor that contains multiple radios
        let current = radio.parentElement;
        let groupContainer = null;
        for (let i = 0; i < 5 && current && current.tagName !== 'BODY'; i++) {
          const radiosInCurrent = current.querySelectorAll('input[type="radio"], [role="radio"], input[type="checkbox"], [role="checkbox"]');
          if (radiosInCurrent.length > 1) {
            groupContainer = current;
            break;
          }
          current = current.parentElement;
        }
        if (groupContainer) {
          const key = 'container_' + globalThis.ParserUtils.getDomPath(groupContainer);
          if (!namedGroups.has(key)) namedGroups.set(key, []);
          // Only push if not already in the array
          if (!namedGroups.get(key).includes(radio)) {
             namedGroups.get(key).push(radio);
          }
        }
      }
    }

    for (const [name, group] of namedGroups.entries()) {
      if (group.length > 1) {
        // Skip if already processed by A11yParser
        const unhandled = group.filter(r => !processedElements.has(r));
        if (unhandled.length === 0) continue;

        unhandled.forEach(r => processedElements.add(r));
        
        let otherTextInput = null;
        if (unhandled.length > 0) {
           let current = unhandled[0].parentElement;
           for (let i = 0; i < 5 && current && current.tagName !== 'BODY'; i++) {
              const radios = current.querySelectorAll('input[type="radio"], [role="radio"]');
              if (radios.length > 1) {
                 const texts = current.querySelectorAll('input[type="text"], textarea, [role="textbox"]');
                 if (texts.length > 0) otherTextInput = texts[texts.length - 1];
                 break;
              }
              current = current.parentElement;
           }
        }

        const baseField = await buildFieldModel(unhandled[0], {
          inputType: unhandled[0].type === 'radio' || unhandled[0].getAttribute('role') === 'radio' ? 'radio-group' : 'checkbox-group',
          radioElements: unhandled,
          optionLabels: unhandled.map(el => globalThis.ParserUtils.getLabelText(el) || el.getAttribute('aria-label') || el.value || el.innerText || ''),
          otherTextInput: otherTextInput
        });
        extracted.push(baseField);
      }
    }

    for (const field of fields) {
      if (processedElements.has(field)) {
         console.log(`[SemanticParser] Skipping already processed field:`, field);
         continue;
      }
      console.log(`[SemanticParser] Processing standalone field:`, field);
      processedElements.add(field);
      extracted.push(await buildFieldModel(field));
    }

    return extracted;
  }

  return { scanFormFields };
})();
