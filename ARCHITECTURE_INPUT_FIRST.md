# Architecture Document: The "Input-First" Approach

## Core Philosophy
The "Input-First" approach (implemented in the `Input-First` branch) was the original architecture for the Autofill Extension. It operated on a bottom-up parsing strategy.

Instead of trying to understand the layout of the page (e.g., finding the question boxes first), it aggressively searched the entire document for any interactive elements (`<input>`, `<select>`, `<textarea>`) and attempted to extract context for each element individually by walking up the DOM tree.

## Implementation Details
1. **Aggressive Querying:**
   `field-extractor.js` used a massive CSS selector to grab every single input element on the page, regardless of its position or wrapping containers.
2. **Bottom-Up Context Extraction:**
   For each individual input, the script would traverse its parent nodes to gather text. This text was combined into a `combinedText` string (e.g., "Full Name Enter your answer").
3. **Classification:**
   The `classifier.js` dictionary engine ran against the `combinedText` of *every single input* separately. 
4. **Heuristic Grouping (Attempted Fixes):**
   When we realized that Radio Buttons were being extracted individually, we added post-extraction grouping logic. We tried grouping radio buttons if they shared the same `name` attribute, or if they shared a common parent wrapper within 6 levels of the DOM tree.

## Why It Failed

While this approach works reasonably well for simple, static HTML forms (like older ATS systems), it completely breaks down when faced with complex, state-driven SPAs like Microsoft Forms.

### 1. The Multi-Choice Fragmentation Problem
Radio buttons and checkboxes are technically distinct `<input>` elements. On a standard HTML form, they share a `name` attribute, making them easy to group. 
- **The Issue:** Microsoft Forms assigns dynamically generated, entirely unique `name` and `id` attributes to *every single radio button* (e.g., `ChoiceGroup1-Option1`, `ChoiceGroup1-Option2`).
- **The Result:** The extension treated a single question like "Which University did you attend?" (with 20 options) as 20 completely separate fields. The Review Panel was spammed with 56+ individual items, making the extension unusable.

### 2. Grouping Heuristics Were Too Brittle
Attempting to group these fragmented inputs after they were extracted proved impossible to do reliably:
- Grouping by `name` failed because MS Forms names are unique.
- Grouping by shared parent containers failed because MS Forms nests radio buttons deep inside complex flexbox layouts. A parent wrapper might hold the "Other" text box, while another holds the radio buttons, preventing a clean grouping.

### 3. Context Dilution
Because the script walked up the DOM tree and grabbed *all* text it could find, the `combinedText` string became polluted with unrelated words (e.g., "Required", "This question is mandatory", or text from adjacent fields). This confused the `classifier.js` engine, leading to extremely low confidence scores or completely incorrect categorizations.

## Conclusion
The bottom-up "Input-First" architecture is fundamentally incompatible with modern web frameworks that utilize custom components, unique dynamic IDs, and deep DOM nesting. It generates an unmanageable volume of false-positive "fields" out of multi-choice options.
