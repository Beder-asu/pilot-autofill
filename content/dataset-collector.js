globalThis.DatasetCollector = (function() {
  async function logEvent(fieldMeta, classificationResult, wasAutofilled, fillTier, wasReviewed, userCorrectedCategory, userSkipped) {
    const record = {
      fieldName: fieldMeta.name,
      fieldId: fieldMeta.id,
      fieldPlaceholder: fieldMeta.placeholder,
      fieldAutocomplete: fieldMeta.autocomplete,
      fieldAriaLabel: fieldMeta.ariaLabel,
      fieldAriaLabelledby: fieldMeta.ariaLabelledby,
      fieldAriaPlaceholder: fieldMeta.ariaPlaceholder,
      fieldLabelText: fieldMeta.labelText,
      fieldSurroundingText: fieldMeta.surroundingText,
      fieldFieldsetLegend: fieldMeta.fieldsetLegend,
      fieldCombinedText: fieldMeta.combinedText,
      fieldTagName: fieldMeta.tagName,
      fieldInputType: fieldMeta.inputType,
      fieldDetectedLanguage: fieldMeta.detectedLanguage,
      
      assignedCategory: classificationResult.assignedCategory,
      confidence: classificationResult.confidence,
      confidenceBand: classificationResult.confidenceBand,
      topMatchedAlias: classificationResult.matchedAliases && classificationResult.matchedAliases.length > 0 ? classificationResult.matchedAliases[0].alias : null,
      topMatchedAliasLanguage: classificationResult.matchedAliases && classificationResult.matchedAliases.length > 0 ? classificationResult.matchedAliases[0].language : null,
      topMatchedSource: classificationResult.matchedAliases && classificationResult.matchedAliases.length > 0 ? classificationResult.matchedAliases[0].source : null,
      fillRoute: classificationResult.fillRoute,

      wasAutofilled,
      fillTier,
      wasReviewed,
      userCorrectedCategory,
      userSkipped,

      source: userCorrectedCategory ? "user_correction" : (userSkipped ? "user_skip" : "rule_engine"),
      isGold: !!(userCorrectedCategory || userSkipped),
      finalCategory: userCorrectedCategory || classificationResult.assignedCategory,

      pageUrl: fieldMeta.pageUrl,
      pageTitle: document.title ? document.title.substring(0, 100) : '',
      inferredPlatform: inferPlatform(fieldMeta.pageUrl),
      sessionId: typeof SESSION_ID !== 'undefined' ? SESSION_ID : 'unknown',
      recordedAt: new Date().toISOString(),
      schemaVersion: 2
    };

    try {
      chrome.runtime.sendMessage({ action: 'LOG_DATASET_RECORD', record: record }, () => {
        if (chrome.runtime.lastError) {
          console.error("[AutoFill] Failed to log dataset record via SW", chrome.runtime.lastError);
        }
      });
    } catch (e) {
      console.error("[AutoFill] Failed to log dataset record", e);
    }
  }

  function inferPlatform(hostname) {
    if (hostname.includes('greenhouse.io')) return 'Greenhouse';
    if (hostname.includes('forms.google.com')) return 'Google Forms';
    if (hostname.includes('workable.com')) return 'Workable';
    if (hostname.includes('lever.co')) return 'Lever';
    if (hostname.includes('myworkdayjobs.com')) return 'Workday';
    return null;
  }

  return { logEvent };
})();
