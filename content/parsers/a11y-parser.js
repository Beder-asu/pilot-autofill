globalThis.A11yParser = (function() {
  const { buildFieldModel, getAriaLabelledbyText, getFieldsetLegend, pierceShadowDOM, getLabelText } = globalThis.ParserUtils;

  async function extractFromContainer(container, role, processedElements) {
    // Collect radios/checkboxes
    const inputSelector = role === 'radiogroup' ? '[role="radio"], input[type="radio"]' : 'input[type="checkbox"], [role="checkbox"]';
    const elements = Array.from(container.querySelectorAll(inputSelector)).filter(el => !processedElements.has(el));
    if (elements.length === 0) return null;

    // Isolate 'Other' textbox if it exists in the same container
    const textSelector = 'input[type="text"], textarea, [role="textbox"]';
    const textInputs = Array.from(container.querySelectorAll(textSelector));
    // Usually the "Other" text input is the last one or closely associated with the last radio
    const otherTextInput = textInputs.length > 0 ? textInputs[textInputs.length - 1] : null;

    // Get overarching question text
    let labelText = getAriaLabelledbyText(container);
    if (!labelText && container.tagName === 'FIELDSET') {
      labelText = getFieldsetLegend(container);
    }
    if (!labelText) {
      labelText = container.getAttribute('aria-label') || '';
    }

    const optionLabels = elements.map(el => getLabelText(el) || el.getAttribute('aria-label') || el.value || el.innerText || '');

    return buildFieldModel(container, {
      inputType: role === 'radiogroup' ? 'radio-group' : 'checkbox-group',
      labelText: labelText,
      radioElements: elements,
      optionLabels: optionLabels,
      otherTextInput: otherTextInput
    });
  }

  async function scanFormFields(rootNode = document) {
    const extracted = [];
    const processedElements = new Set();
    
    const containers = pierceShadowDOM(rootNode, [], '[role="radiogroup"], fieldset, [role="group"]');
    
    for (const container of containers) {
      let role = container.getAttribute('role') || '';
      if (container.tagName === 'FIELDSET' && !role) role = 'radiogroup';
      if (!role) role = 'group';
      
      console.log(`[A11yParser] Processing container: tagName=${container.tagName}, role=${role}`, container);

      const model = await extractFromContainer(container, role, processedElements);
      if (model) {
         console.log(`[A11yParser] Successfully built model for container, radioElements count:`, model.radioElements?.length);
      }
      if (model && model.radioElements && model.radioElements.length > 0) {
        model.radioElements.forEach(el => processedElements.add(el));
        if (model.otherTextInput) processedElements.add(model.otherTextInput);
        extracted.push(model);
      }
    }
    
    return { models: extracted, processedElements };
  }

  return { scanFormFields };
})();
