globalThis.FuzzySelectMatcher = (function() {
  function levenshtein(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
        }
      }
    }
    return matrix[b.length][a.length];
  }

  function similarityScore(a, b) {
    if (!a || !b) return 0;
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1.0;
    const distance = levenshtein(a, b);
    let baseScore = (maxLen - distance) / maxLen;
    
    if (b.includes(a) || a.includes(b)) {
      baseScore = Math.max(baseScore, 0.7);
    }
    return baseScore;
  }

  function selectBestOption(selectElement, profileValue) {
    if (!profileValue) return { option: null, score: 0 };
    
    const options = Array.from(selectElement.options);
    const normalized = profileValue.toLowerCase().trim();

    let bestScore = 0;
    let bestOption = null;

    for (const option of options) {
      if (option.disabled || option.value === "") continue;
      const optionText = option.text.toLowerCase().trim();
      const optionValue = option.value.toLowerCase().trim();
      
      if (optionText === normalized || optionValue === normalized) {
        return { option: option, score: 1.0 };
      }

      const score = Math.max(
        similarityScore(normalized, optionText),
        similarityScore(normalized, optionValue)
      );
      
      if (score > bestScore) {
        bestScore = score;
        bestOption = option;
      }
    }

    return { option: bestOption, score: bestScore };
  }

  return { selectBestOption };
})();
