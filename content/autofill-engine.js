globalThis.AutofillEngine = (function() {
  const CATEGORY_MAP = {
    FIRST_NAME: (p) => p.personal.firstName,
    MIDDLE_NAME: (p) => p.personal.middleName,
    LAST_NAME: (p) => p.personal.lastName,
    PREFERRED_NAME: (p) => p.personal.preferredName,
    FULL_NAME: (p) => `${p.personal.firstName} ${p.personal.lastName}`.trim(),
    EMAIL: (p) => p.personal.email,
    PHONE: (p) => p.personal.phone,
    BIRTHDAY: (p) => p.personal.birthday,
    PRONOUNS: (p) => p.personal.pronouns,
    GENDER: (p) => p.personal.gender,
    ETHNICITY: (p) => p.personal.ethnicity,
    VETERAN_STATUS: (p) => p.personal.veteranStatus,
    DISABILITY_STATUS: (p) => p.personal.disabilityStatus,
    ADDRESS_LINE_1: (p) => p.personal.address.line1,
    ADDRESS_LINE_2: (p) => p.personal.address.line2,
    CITY: (p) => p.personal.address.city,
    STATE: (p) => p.personal.address.state,
    ZIP: (p) => p.personal.address.zip,
    COUNTRY: (p) => p.personal.address.country,
    LINKEDIN: (p) => p.professional.linkedin,
    GITHUB: (p) => p.professional.github,
    PORTFOLIO: (p) => p.professional.portfolio,
    CURRENT_COMPANY: (p) => p.professional.currentCompany,
    CURRENT_TITLE: (p) => p.professional.currentTitle,
    YEARS_OF_EXPERIENCE: (p) => p.professional.yearsOfExperience,
    UNIVERSITY: (p) => p.education.university,
    DEGREE: (p) => p.education.degree,
    FACULTY: (p) => p.education.faculty,
    FIELD_OF_STUDY: (p) => p.education.fieldOfStudy,
    STUDENT_LEVEL: (p) => p.education.studentLevel,
    GPA: (p) => p.education.gpa,
    GRADUATION_YEAR: (p) => p.education.graduationYear,
    SALARY_EXPECTATION: (p) => p.preferences.salaryExpectation,
    START_DATE: (p) => p.preferences.startDate,
    NOTICE_PERIOD: (p) => p.preferences.noticePeriod,
    RELOCATION: (p) => p.preferences.relocation,
    TRAVEL_PERCENTAGE: (p) => p.preferences.travelPercentage,
    LANGUAGES: (p) => p.preferences.languages,
    WORK_AUTHORIZATION: (p) => p.preferences.workAuthorization,
    AI_INSTRUCTIONS: (p) => p.preferences.aiInstructions
  };

  const delay = ms => new Promise(r => setTimeout(r, ms));

  async function fillField(element, value, inputType, fieldMeta = null) {
    if (!value || element.disabled) return { success: false, tier: null };

    // Sanitization for number inputs + intl-tel-input support
    if (element.type === 'number') {
      let cleaned = String(value).replace(/[^\d]/g, '');
      if (!cleaned) return { success: false, tier: null };

      const cls = element.className || '';
      const isIntlPhone = cls.includes('input-phone') || cls.includes('countries-ext') ||
        !!element.closest?.('.intl-tel-input, .iti');

      if (isIntlPhone) {
        cleaned = cleaned.replace(/^0+(?=[1-9])/, '');
      }
      value = cleaned;
    }

    // Date formatting (YYYY-MM-DD -> match field parts if possible)
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      if (element.type === 'date') {
        // native date pickers want YYYY-MM-DD
      } else if (fieldMeta && fieldMeta.combinedText) {
        const text = fieldMeta.combinedText.toLowerCase();
        const parts = value.split('-'); // [YYYY, MM, DD]
        if (text.includes('month') && !text.includes('day') && !text.includes('year')) value = parts[1];
        else if (text.includes('year') && !text.includes('day') && !text.includes('month')) value = parts[0];
        else if (text.includes('day') && !text.includes('year') && !text.includes('month')) value = parts[2];
        else value = `${parts[1]}/${parts[2]}/${parts[0]}`; // MM/DD/YYYY fallback
      }
    }


    // ── Radio group ────────────────────────────────────────────────────────────
    // fieldMeta.radioElements holds the individual <input type="radio"> nodes.
    // We find the one whose associated label best matches the profile value.
    if (inputType === 'radio-group' && fieldMeta && fieldMeta.radioElements && fieldMeta.radioElements.length > 0) {
      const target = String(value).toLowerCase().trim();
      const radios = fieldMeta.radioElements;

      // Build scored list: exact label match > startsWith > includes
      let best = null, bestScore = -1;
      for (const r of radios) {
        // Label text: try explicit label, aria-label, then value attribute
        let lbl = '';
        if (r.id) {
          const lel = document.querySelector(`label[for="${r.id}"]`);
          if (lel) lbl = (lel.innerText || lel.textContent || '').toLowerCase().trim();
        }
        if (!lbl) lbl = (r.getAttribute('aria-label') || r.value || '').toLowerCase().trim();

        let score = 0;
        if (lbl === target) score = 100;
        else if (lbl.startsWith(target) || target.startsWith(lbl)) score = 60;
        else if (lbl.includes(target) || target.includes(lbl)) score = 30;

        if (score > bestScore) { best = r; bestScore = score; }
      }

      if (best && bestScore > 0) {
        best.checked = true;
        best.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        best.dispatchEvent(new Event('change', { bubbles: true }));
        await delay(80);
        return { success: true, tier: 1 };
      }
      // No matching option — report failure so the overlay can surface it
      return { success: false, tier: null };
    }

    // ── Checkbox group (multi-select) ──────────────────────────────────────────
    if (inputType === 'checkbox-group' && fieldMeta && fieldMeta.radioElements) {
      const targets = String(value).toLowerCase().split(/[,;]+/).map(s => s.trim()).filter(Boolean);
      let any = false;
      for (const cb of fieldMeta.radioElements) {
        let lbl = '';
        if (cb.id) {
          const lel = document.querySelector(`label[for="${cb.id}"]`);
          if (lel) lbl = (lel.innerText || lel.textContent || '').toLowerCase().trim();
        }
        if (!lbl) lbl = (cb.getAttribute('aria-label') || cb.value || '').toLowerCase().trim();
        if (targets.some(t => lbl.includes(t) || t.includes(lbl))) {
          cb.checked = true;
          cb.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          cb.dispatchEvent(new Event('change', { bubbles: true }));
          any = true;
        }
      }
      await delay(80);
      return { success: any, tier: any ? 1 : null };
    }

    // Dropdowns (select / combobox)
    if (element.tagName === 'SELECT' || element.getAttribute('role') === 'combobox') {
      if (element.tagName === 'SELECT') {
        const options = Array.from(element.options);
        const lowerVal = String(value).toLowerCase();
        
        let exactMatch = options.find(o => o.text.toLowerCase() === lowerVal || o.value.toLowerCase() === lowerVal);
        let looseMatch = !exactMatch ? options.find(o => o.text.toLowerCase().includes(lowerVal) || lowerVal.includes(o.text.toLowerCase())) : null;
        
        let match = exactMatch || looseMatch;
        if (match) {
          element.value = match.value;
          element.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true, tier: 1 };
        }
      }
      // If combobox and we didn't return, we'll fall through to text injection
    }

    // Tier 1: Direct value setting + events
    element.focus();
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.blur();
    
    await delay(100);
    if (element.value === value) {
      return { success: true, tier: 1 };
    }

    // Tier 2: React/Vue synthetic keyboard events
    if (element.value !== value) {
      element.focus();
      element.value = '';
      for (const char of String(value)) {
        element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
        element.value += char;
        element.dispatchEvent(new InputEvent('input', { data: char, inputType: 'insertText', bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
        await delay(20 + Math.random() * 20);
      }
      element.dispatchEvent(new Event('change', { bubbles: true }));
      
      await delay(150);
      if (element.value === value) {
        return { success: true, tier: 2 };
      }
    }

    return { success: false, tier: 3 };
  }

  function getProfileValueForCategory(category, profile) {
    // EEO Guard: Never return EEO data for automatic filling
    const eeoCategories = ['GENDER', 'ETHNICITY', 'VETERAN_STATUS', 'DISABILITY_STATUS'];
    if (eeoCategories.includes(category)) return '';

    if (CATEGORY_MAP[category]) {
      return CATEGORY_MAP[category](profile);
    }
    return '';
  }

  return { fillField, getProfileValueForCategory };
})();
