# Pilot Autofill - question-first Architecture (Archived)

This branch preserves the **question-first** experimental approach to parsing web forms. 

## Architecture

In this architecture, the parser was designed to simulate how a human reads a form:
1. Scan the DOM for text nodes that look like "questions" or labels.
2. Once a label is identified, search forward/downward in the DOM tree for the nearest input field.
3. Bind the found input field to the text label.

## Why this approach was abandoned

While the `question-first` approach worked well for simple, flat HTML forms, it failed on complex real-world forms (like Microsoft Forms, Greenhouse, and modern React apps) for several reasons:

1. **DOM Detachment**: In modern SPA frameworks, labels and their corresponding inputs are often rendered in completely separate DOM branches, making it impossible to find the input by simply "looking nearby".
2. **Shadow DOM**: Inputs hidden inside shadow roots were invisible to the text-first traversal logic.
3. **Irrelevant Text**: The parser frequently picked up instructional text or tooltips as "questions", leading to false positives and misaligned field mapping.
4. **Radio/Checkbox Groups**: It was exceptionally difficult to group multiple text labels (e.g., "Male", "Female") under a single parent question (e.g., "Gender") using visual proximity alone.

The main branch (`a11y-first`) resolves these issues by using the browser's built-in accessibility tree (`aria-labelledby`, etc.) instead of guessing based on visual DOM structure.
