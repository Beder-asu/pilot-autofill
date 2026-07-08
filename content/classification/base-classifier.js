globalThis.BaseClassifier = (function() {
  const ruleBased = globalThis.RuleBasedClassifier;
  const aiAssisted = globalThis.AIAssistedClassifier;

  // Session cache: avoids re-classifying the same field on every mutation cycle
  const _cache = new Map();

  async function classify(fieldMeta) {
    // Return cached result for this field fingerprint if available
    if (_cache.has(fieldMeta.fingerprint)) {
      return _cache.get(fieldMeta.fingerprint);
    }

    let result = null;

    // 1. Rule-Based classifier — single call, result reused below
    if (ruleBased) {
      result = ruleBased.classify(fieldMeta);
      if (result && result.confidenceBand === 'HIGH') {
        _cache.set(fieldMeta.fingerprint, result);
        return result; // Fast path
      }
    }

    // 2. AI-Assisted fallback — DISABLED (uncomment to re-enable)
    // if (aiAssisted) {
    //   const aiResult = await aiAssisted.classify(fieldMeta);
    //   if (aiResult && aiResult.assignedCategory !== 'UNKNOWN') {
    //     _cache.set(fieldMeta.fingerprint, aiResult);
    //     return aiResult;
    //   }
    // }

    // 3. Return best rule-based guess (reuse from step 1, no second call)
    if (result) {
      _cache.set(fieldMeta.fingerprint, result);
      return result;
    }

    const fallback = {
      fieldFingerprint: fieldMeta.fingerprint,
      assignedCategory: 'UNKNOWN',
      confidence: 0,
      confidenceBand: 'UNKNOWN',
      fillRoute: 'overlay',
      classifiedAt: new Date().toISOString()
    };
    _cache.set(fieldMeta.fingerprint, fallback);
    return fallback;
  }

  // Allow cache invalidation when the user manually re-classifies a field
  function invalidate(fingerprint) {
    if (fingerprint) _cache.delete(fingerprint);
    else _cache.clear();
  }

  return { classify, invalidate };
})();
