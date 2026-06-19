globalThis.FormMutationObserver = (function() {
  const observedFingerprints = new Set();
  let observer = null;
  let idleTimer = null;
  let mutationCount = 0;
  const IDLE_TIMEOUT_MS = 60000;
  const MUTATION_CAP = 5000;
  
  let onRescanCallback = null;
  let debounceTimer = null;

  function setCallback(cb) {
    onRescanCallback = cb;
  }

  function debouncedRescan(newFields) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (onRescanCallback) onRescanCallback(newFields);
    }, 300);
  }

  function startObserver() {
    if (observer) return;
    
    observer = new MutationObserver(async (mutations) => {
      mutationCount += mutations.length;

      if (mutationCount > MUTATION_CAP) {
        console.warn('[AutoFill] MutationObserver cap reached — disconnecting');
        stopObserver();
        return;
      }

      const newFields = [];
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          
          let fields = [];
          if (node.matches && node.matches('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]):not([type=checkbox]), textarea, select, [role="textbox"], [role="combobox"], [contenteditable="true"], [role="radiogroup"]')) {
             fields.push(node);
          }
          
          const nestedFields = [];
          
          function findFieldsInNode(root) {
            const selector = 'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]):not([type=checkbox]), textarea, select, [role="textbox"], [role="combobox"], [contenteditable="true"], [role="radiogroup"]';
            const matches = root.querySelectorAll(selector);
            matches.forEach(el => nestedFields.push(el));

            const allNodes = root.querySelectorAll('*');
            for (const n of allNodes) {
              if (n.shadowRoot) {
                // Also attach observer to new shadow roots
                observer.observe(n.shadowRoot, { childList: true, subtree: true });
                findFieldsInNode(n.shadowRoot);
              }
            }
          }
          findFieldsInNode(node);
          
          fields = fields.concat(nestedFields);

          for (const field of fields) {
            const extracted = await globalThis.FieldExtractor.extractField(field);
            if (!observedFingerprints.has(extracted.fingerprint)) {
              observedFingerprints.add(extracted.fingerprint);
              newFields.push(extracted); 
            }
          }
        }
      }

      if (newFields.length > 0) {
        resetIdleTimer();
        debouncedRescan(newFields);
      }
    });

    function observeExistingShadows(root) {
      const allNodes = root.querySelectorAll('*');
      for (const n of allNodes) {
        if (n.shadowRoot) {
          observer.observe(n.shadowRoot, { childList: true, subtree: true });
          observeExistingShadows(n.shadowRoot);
        }
      }
    }

    observer.observe(document.body, { childList: true, subtree: true });
    observeExistingShadows(document.body);
    
    resetIdleTimer();
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    clearTimeout(idleTimer);
  }

  function resetIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(stopObserver, IDLE_TIMEOUT_MS);
  }
  
  function triggerFullRescan() {
    if (onRescanCallback) onRescanCallback('FULL');
  }

  function handleUserActivity() {
    if (!observer) {
      startObserver();
      triggerFullRescan();
    }
  }

  const RECONNECT_EVENTS = ['click', 'keydown', 'scroll'];
  RECONNECT_EVENTS.forEach(event =>
    document.addEventListener(event, handleUserActivity, { passive: true, once: false })
  );

  window.addEventListener('popstate', triggerFullRescan);
  window.addEventListener('hashchange', triggerFullRescan);

  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      triggerFullRescan();
    }
  }, 1000);

  return { startObserver, stopObserver, setCallback, observedFingerprints };
})();
