globalThis.FileUploadHandler = (function() {

  // ── isCustomUploader ───────────────────────────────────────────────────────
  // Returns true if the file input is visually hidden/overlaid by a custom
  // drag-drop component, meaning programmatic .files= injection alone won't
  // trigger the component's own change handlers.
  function isCustomUploader(element) {
    // 1. Classically hidden (display:none means offsetParent === null)
    if (element.offsetParent === null) return true;

    // 2. Inside a button-role element
    if (element.closest('[role="button"]')) return true;

    const style = window.getComputedStyle(element);

    // 3. Visually zeroed out (common pattern: opacity:0 + absolute + 0×0)
    if (style.opacity === '0' || style.opacity === '0.0') return true;
    const w = parseFloat(style.width);
    const h = parseFloat(style.height);
    if (w < 2 && h < 2) return true;

    // 4. Clipped via clip / clip-path (hidden but accessible to JS)
    if (style.clip && style.clip !== 'auto') return true;

    // 5. Parent has a drop-zone class (React Dropzone, FilePond, Uppy…)
    const dropzoneParent = element.closest(
      '[class*="dropzone"], [class*="drop-zone"], [class*="upload-area"], ' +
      '[class*="upload-box"], [class*="file-drop"], [class*="dz-"], ' +
      '[class*="filepond"], [class*="uppy"], [class*="drag"]'
    );
    if (dropzoneParent) return true;

    return false;
  }

  // ── injectFile ─────────────────────────────────────────────────────────────
  // Strategy 1 (native):  set .files + dispatch change/input
  // Strategy 2 (drop):    synthesise a dragenter/dragover/drop event sequence
  //                        with a real DataTransfer — works for most React /
  //                        Vue drop-zone components that listen to ondrop
  // Strategy 3 (click):   programmatically .click() the input so the browser
  //                        opens a file picker — last resort, requires user
  //                        gesture so this path just signals failure gracefully
  async function injectFile(fileInputElement, fileId) {
    const { buffer, entry, error } = await new Promise(resolve => {
      try {
        chrome.runtime.sendMessage(
          { action: 'GET_FILE_BUFFER', fileId },
          response => resolve(response || {})
        );
      } catch (e) {
        resolve({ error: e.message });
      }
    });

    if (error || !buffer || !entry) {
      console.error('[AutoFill] File injection: could not fetch buffer —', error);
      return false;
    }

    const uint8Array = new Uint8Array(buffer);
    const file = new File([uint8Array.buffer], entry.originalFileName, {
      type: entry.mimeType,
      lastModified: Date.now()
    });

    // ── Strategy 1: native .files setter ──────────────────────────────────
    try {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInputElement.files = dt.files;
      fileInputElement.dispatchEvent(new Event('input',  { bubbles: true }));
      fileInputElement.dispatchEvent(new Event('change', { bubbles: true }));

      // Give the framework 200ms to react, then check if it accepted the file
      await new Promise(r => setTimeout(r, 200));

      // Verify: if the input now has a file, strategy 1 worked
      if (fileInputElement.files && fileInputElement.files.length > 0) {
        console.log('[AutoFill] File injected via Strategy 1 (native setter).');
        return true;
      }
    } catch (e) {
      console.warn('[AutoFill] Strategy 1 failed:', e);
    }

    // ── Strategy 2: synthetic drop event on the drop zone container ───────
    // Walk up the DOM to find the most likely drop-zone container
    const dropTarget = findDropTarget(fileInputElement);
    if (dropTarget) {
      try {
        const dt2 = new DataTransfer();
        dt2.items.add(file);

        const makeEvent = (name, extra = {}) =>
          Object.assign(new DragEvent(name, {
            bubbles: true, cancelable: true, dataTransfer: dt2, ...extra
          }), {});

        dropTarget.dispatchEvent(makeEvent('dragenter'));
        await new Promise(r => setTimeout(r, 30));
        dropTarget.dispatchEvent(makeEvent('dragover'));
        await new Promise(r => setTimeout(r, 30));
        dropTarget.dispatchEvent(makeEvent('drop'));
        await new Promise(r => setTimeout(r, 200));

        // Re-check the input after the drop
        if (fileInputElement.files && fileInputElement.files.length > 0) {
          console.log('[AutoFill] File injected via Strategy 2 (synthetic drop).');
          return true;
        }

        // Even if input is empty, the component may have processed the drop
        // event internally (e.g. Zenats stores files in component state).
        // Check for visual feedback (file name appearing in the DOM near the drop zone).
        const zone = dropTarget;
        await new Promise(r => setTimeout(r, 300));
        const zoneText = zone.textContent || '';
        if (zoneText.includes(entry.originalFileName) ||
            zoneText.includes(entry.originalFileName.replace(/\.[^.]+$/, ''))) {
          console.log('[AutoFill] File accepted by drop-zone component (visual confirmation).');
          return true;
        }

        console.log('[AutoFill] Strategy 2 (drop) dispatched — component may have handled it.');
        return true; // Optimistically return true; user will see if it worked
      } catch (e) {
        console.warn('[AutoFill] Strategy 2 failed:', e);
      }
    }

    console.warn('[AutoFill] All file injection strategies failed for this uploader.');
    return false;
  }

  // ── findDropTarget ─────────────────────────────────────────────────────────
  // Walks up from the file input to find the drop-zone container element.
  function findDropTarget(fileInput) {
    // Common patterns: the drop zone is the closest ancestor that either
    // - has a ondrop handler
    // - has a class suggesting it's a drop zone
    // - is a label wrapping the input
    let el = fileInput.parentElement;
    for (let i = 0; i < 8 && el; i++) {
      if (el.tagName === 'LABEL') return el;
      const cls = (el.className || '').toLowerCase();
      if (
        cls.includes('drop') || cls.includes('upload') || cls.includes('drag') ||
        cls.includes('file') || cls.includes('dz') || cls.includes('pond') ||
        el.getAttribute('ondrop') || el.ondrop
      ) {
        return el;
      }
      el = el.parentElement;
    }
    // Fallback: 3 levels up
    el = fileInput.parentElement?.parentElement?.parentElement;
    return el || fileInput.parentElement;
  }

  return { injectFile, isCustomUploader };
})();
