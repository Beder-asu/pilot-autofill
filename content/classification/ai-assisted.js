globalThis.AIAssistedClassifier = (function() {
  async function classify(fieldMeta) {
    const context = `
      Label: ${fieldMeta.labelText || fieldMeta.ariaLabelledby}
      Placeholder: ${fieldMeta.placeholder}
      Surrounding Text: ${fieldMeta.surroundingText}
      Input Name: ${fieldMeta.name}
      Input ID: ${fieldMeta.id}
    `;

    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'CLASSIFY_FIELD', context },
        (response) => {
          if (chrome.runtime.lastError || !response || response.error) {
            console.warn('[AutoFill] AI Classification failed:', response?.error || chrome.runtime.lastError?.message);
            resolve(null);
            return;
          }
          
          let category = response.category;
          if (!category || category === 'UNKNOWN') {
            resolve(null);
            return;
          }

          resolve({
            fieldFingerprint: fieldMeta.fingerprint,
            assignedCategory: category,
            confidence: 0.9, // AI confidence
            confidenceBand: 'HIGH',
            fillRoute: 'autofill',
            classifiedAt: new Date().toISOString()
          });
        }
      );
    });
  }

  return { classify };
})();
