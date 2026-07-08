globalThis.NativeFiller = (function() {
  function setValue(element, value) {
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function click(element) {
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    element.click();
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  return { setValue, click };
})();
