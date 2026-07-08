# Pilot Autofill - Input-First Architecture (Archived)

This branch preserves the **Input-First** experimental approach to parsing web forms.

## Architecture

This iteration attempted a bottom-up parsing strategy:
1. First, scan the DOM for all interactable elements (`<input>`, `<select>`, `<textarea>`).
2. For each input found, traverse backwards and upwards through the DOM tree.
3. Find the closest text node and assume it is the label for that input.

## Why this approach was abandoned

While the bottom-up approach seemed robust at first, it suffered from severe mapping errors in complex UIs:

1. **Greedy Text Matching**: When searching backwards, the parser would frequently hit unrelated text elements first (like "Required field", "Help tooltip", or "Max 50 characters") and incorrectly assign them as the label for the input.
2. **Disconnected Labels**: In table layouts or CSS Grid structures, the label for an input is visually adjacent but structurally far away in the DOM tree, causing the reverse-traversal to fail completely.
3. **Radio Groups**: For a group of radio buttons under a single question (e.g., "Gender: [ ] Male [ ] Female"), the parser would only find the immediate label ("Male") but fail to associate it with the overarching category question ("Gender").
4. **Performance**: Scanning backwards from every single input on massive enterprise forms caused performance bottlenecks.

The main branch (`a11y-first`) resolves these issues by using the browser's built-in accessibility tree to reliably associate inputs with their true semantic labels, bypassing visual DOM structure entirely.
