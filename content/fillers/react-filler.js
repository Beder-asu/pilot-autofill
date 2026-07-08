globalThis.ReactFiller = (function() {
  function setValue(element, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    
    if (element.tagName === 'TEXTAREA') {
      nativeTextAreaValueSetter.call(element, value);
    } else {
      nativeInputValueSetter.call(element, value);
    }
    
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function click(element) {
    // React synthetic events need careful dispatch
    element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    element.focus();
    element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    element.click();
    
    // Attempt native setter for radio/checkbox just in case
    if (element.type === 'radio' || element.type === 'checkbox') {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "checked").set;
      nativeSetter.call(element, true);
      element.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Some React SPAs (like Microsoft Forms) use visually hidden inputs and require clicking the label wrapper
      if (element.type === 'radio') {
         const parentLabel = element.closest('label');
         if (parentLabel) {
             parentLabel.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
             parentLabel.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
             parentLabel.click();
         } else if (element.parentElement) {
             // Fallback if no label exists
             element.parentElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
             element.parentElement.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
             element.parentElement.click();
         }
      }
    }
  }

  return { setValue, click };
})();
