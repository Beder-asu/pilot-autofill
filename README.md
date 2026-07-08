# 🚀 Pilot Autofill

**The smartest, most resilient job application autofill extension.**

Pilot Autofill isn't just another form filler. It's a deep-DOM traversing, React-aware, AI-powered assistant designed to conquer the most notoriously difficult job application portals on the web (Workday, Greenhouse, Microsoft Forms, and more).

---

## 📖 The Journey: How We Got Here

Building a universal form filler is hard. Modern web applications don't use standard HTML forms anymore. They use heavily nested `<div>` structures, virtual DOMs, Shadow DOMs, and synthetic event systems that actively block programmatic interaction.

We tried multiple approaches:
1. **Input-First (Archived):** We tried finding inputs and scanning backwards for labels. It failed on CSS grids and complex layouts where the visual label was detached from the input.
2. **Question-First (Archived):** We tried finding text questions and scanning forwards for inputs. It failed on Shadow DOMs and grouped radio buttons.
3. **a11y-first (This Branch - The Winner):** We stopped looking at visual layout and started looking at the **Accessibility Tree**. By utilizing ARIA attributes (`aria-labelledby`, `aria-label`) and falling back to a custom Semantic Parser, we achieved near-perfect field mapping across the most hostile modern web frameworks.

---

## ✨ Core Features

- **🧠 Dual-Parser Engine:** Combines an Accessibility Parser (for modern, ARIA-compliant forms) with a Semantic Fallback Parser (for legacy forms).
- **🛡️ React & Framework Defeater:** Modern React apps ignore `.value = "x"`. Pilot Autofill intercepts native setters and dispatches raw `PointerEvent` and `MouseEvent` synthetic events to simulate real human interaction.
- **🔦 Shadow DOM Piercing:** Seamlessly enters closed/open Shadow Roots to find and fill inputs that other extensions can't even see.
- **🌍 Bilingual Classification:** Understands both English and Arabic form fields with a highly tuned alias dictionary.
- **🤖 AI Essay Generation:** Integrated directly with Gemini & OpenAI to read essay questions (e.g., "Why do you want to work here?") and generate tailored answers on the fly based on your profile.

---

## 🛠️ Getting Started (Installation)

Pilot Autofill is a Chrome Extension. To install it locally for development:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Beder-asu/pilot-autofill.git
   cd pilot-autofill/Extension
   ```
2. **Open Chrome Extensions:**
   Navigate to `chrome://extensions/` in your browser.
3. **Enable Developer Mode:**
   Toggle the "Developer mode" switch in the top right corner.
4. **Load the Extension:**
   Click **"Load unpacked"** and select the `Extension` folder you just cloned.

---

## 🎯 How to Use It

### Step 1: Set Up Your Profile
1. Click the Pilot Autofill icon in your Chrome toolbar.
2. Open the **Settings** page.
3. Fill out your structured profile (Personal Info, Education, Experience, Links).
4. Go to the **AI Model** tab, enter your Gemini or OpenAI API key, and select a model (we recommend `gemini-3.1-flash-lite` for the best free-tier quota).
5. **Save** your profile.

### Step 2: AutoFill a Form
1. Navigate to any job application form (e.g., a Greenhouse application or Microsoft Form).
2. You'll see a floating **"AutoFill"** button injected into the page.
3. Click it! The extension will scan the DOM, pierce shadow roots, and classify every field.

### Step 3: The Review Panel
High-confidence fields (like First Name, Email, Phone) are filled instantly. For complex or ambiguous fields, the beautiful **Review Panel** slides in.

- **Accept / Skip:** Quickly review the AI's suggestions and accept or skip them.
- **✨ Generate with AI:** For essay questions or cover letters, simply select the `ESSAY_QUESTION` category from the dropdown, add any custom notes (optional), and click **Generate with AI**. The extension will write the essay based on your profile and inject it into the text box.
- **Fill Confirmed:** Once you're happy with the panel, click Fill Confirmed to dispatch the final events and complete the form.

---

## 🏗️ Technical Architecture

Under the hood, Pilot Autofill operates in distinct phases:

1. **Extraction:** `A11yParser` and `SemanticParser` traverse the DOM, returning structured `FieldMeta` objects containing labels, placeholders, attributes, and precise bounding boxes.
2. **Classification:** The `RuleBasedClassifier` runs regex pre-passes, normalizes camelCase IDs, and scores fields against a bilingual alias dictionary. Results are cached per-session.
3. **Execution:** The `AutofillEngine` coordinates with the `FillerFactory` to instantiate either a `NativeFiller` (for plain HTML) or a `ReactFiller` (for SPAs) to safely inject data without breaking page state.
4. **UI Overlay:** A completely isolated Shadow DOM overlay hosts the Review Panel, preventing the host page's CSS from breaking the extension's UI.
