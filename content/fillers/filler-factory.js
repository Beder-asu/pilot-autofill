globalThis.FillerFactory = (function() {
  function detectFramework() {
    // Simple heuristic for React
    const rootNodes = document.querySelectorAll('*');
    for (let i = 0; i < Math.min(100, rootNodes.length); i++) {
       const keys = Object.keys(rootNodes[i]);
       if (keys.some(k => k.startsWith('__reactFiber$'))) {
         return 'react';
       }
    }
    return 'native';
  }

  function getFiller() {
    const framework = detectFramework();
    console.log(`[AutoFill] Detected framework: ${framework}`);
    if (framework === 'react') {
      return globalThis.ReactFiller;
    }
    return globalThis.NativeFiller;
  }

  return { getFiller };
})();
