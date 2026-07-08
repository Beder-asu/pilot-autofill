# Pilot Autofill - a11y-first Architecture (Main)

This branch contains the production-ready implementation of the Pilot Autofill extension. It uses an **accessibility-first** approach to parsing and filling web forms.

## Architecture

The extension relies on a dual-parser system designed to handle complex, heavily nested forms (like MS Forms, Greenhouse, Workday, and custom React applications).

### 1. `A11yParser`
This parser navigates the DOM looking for semantic accessibility signals rather than visual layout:
- Reads `aria-labelledby`, `aria-label`, and `aria-describedby`
- Uses `pierceShadowDOM` to enter closed/open shadow roots where some modern form elements live.
- Accurately associates custom React radio groups (`[role="radiogroup"]`) with their child options.

### 2. `SemanticParser`
A fallback parser that uses DOM traversal to find the closest visually associated `<label>` elements when accessibility tags are missing.

### 3. Event Handling (`ReactFiller` / `NativeFiller`)
Modern frameworks like React ignore programmatic `.value = ...` changes because they track state internally. The extension implements a `ReactFiller` strategy that:
- Dispatches synthetic `PointerEvent` and `MouseEvent` events to wrapper labels (e.g., clicking the visual radio button rather than the hidden input).
- Properly triggers React's internal state changes using native setter interception.

### 4. Classification
The `RuleBasedClassifier` assigns field categories (e.g., `FIRST_NAME`, `ESSAY_QUESTION`) by comparing field metadata against a localized alias dictionary (English and Arabic). It supports regex pre-passes and UI confidence thresholding.

## Why this approach won
Previous attempts (`question-first` and `Input-First`) failed on complex forms because they relied on visual DOM proximity or hardcoded tag names, which easily break in shadow DOMs, highly nested `div` structures, or custom React implementations. The `a11y-first` approach relies on the browser's accessibility tree, which is robust and consistently maintained by modern UI libraries.
