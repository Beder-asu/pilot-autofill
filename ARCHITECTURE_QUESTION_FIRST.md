# Architecture Document: The "Question-First" Approach

## Core Philosophy
The "Question-First" approach (implemented in the `question-first` branch) attempted to solve the problem of fragmented radio buttons and checkboxes by parsing the DOM top-down rather than bottom-up. 

Instead of treating every `<input>` as an independent field, this architecture searched for "Question Containers"—large DOM blocks that visually group a question title with its interactive inputs.

## Implementation Details
1. **Container Identification:**
   The `field-extractor.js` script used a list of hardcoded CSS classes (`.office-form-question`, `.question-container`, `.freebirdFormviewerViewItemsItemItem`, etc.) to find the overarching containers.
2. **Top-Down Extraction:**
   Inside each identified container:
   - It extracted the overarching question text (e.g., from `<h3>`, `<span>`, or `<legend>`).
   - It gathered all interactive elements (`<input>`, `<select>`, `<textarea>`).
   - If multiple radio buttons or checkboxes were found inside the container, they were bundled together into a single `FieldModel` of type `radio-group` or `checkbox-group`.
3. **Data Model:**
   The `FieldModel` was updated to hold an array of `radioElements` and an array of their corresponding `options` labels. The classification engine (`classifier.js`) would then classify the *container's* title text instead of the individual option labels.
4. **Fallback Mechanism:**
   If no containers were found (or if the container logic crashed), the script fell back to a bottom-up "Input-First" scan (`_fallbackScan`).

## Why It Failed

Despite theoretically creating clean, grouped fields (e.g., collapsing 56 scattered radio options into 14 clean questions), the approach proved entirely too brittle for highly dynamic, React-based SPAs like Microsoft Forms.

### 1. The "Other" Text Box Glitch
MS Forms includes `<input type="text">` elements immediately alongside the "Other" radio option. 
- Because this text box sat inside the "University" question container, our extractor grouped it together. 
- However, if the text box was miscategorized or processed separately (which happened during fallbacks), the Autofill Engine would begin typing into the "Other" text box character-by-character.
- **The React Collision:** MS Forms intercepts keyboard events to control focus jumping between radio options. Typing "T-h-e A-m-..." caused the UI focus to aggressively jump between different radio buttons, finally settling on "Other".

### 2. React State Rejection
Clicking the hidden `<input type="radio">` DOM elements using `element.dispatchEvent(new MouseEvent('click'))` completely failed to register with MS Forms' underlying React state. React expects explicit user interactions on the styled `<label>` wrappers or custom `<div>` checkboxes. Without perfectly mimicking React's expected `pointerdown`, `mousedown`, `mouseup`, and `click` sequence on the exact visual wrapper, the selections were ignored by the form submission logic.

### 3. Selector Brittleness & Fallback Spam
The top-down approach relies 100% on knowing the exact CSS classes MS Forms uses for its containers (`.office-form-question`). MS Forms obfuscates its classes (e.g., `.geS5n`) and changes them frequently.
- When MS Forms generated unexpected DOM structures or invalid HTML IDs (causing `querySelector` to crash with `SyntaxError`), the entire top-down logic aborted.
- The system would silently fall back to the raw `_fallbackScan`, instantly re-spamming the Review Panel with 56 disconnected options, completely defeating the purpose of the architecture.

## Conclusion
Top-down container querying is a fundamentally flawed approach for modern enterprise forms because it relies heavily on visual layout heuristics and specific CSS classes that are constantly rewritten, obfuscated, or broken by dynamic frameworks.
