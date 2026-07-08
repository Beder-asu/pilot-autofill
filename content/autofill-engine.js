globalThis.AutofillEngine = (function() {
  const { scanFormFields: scanA11y } = globalThis.A11yParser || {};
  const { scanFormFields: scanSemantic } = globalThis.SemanticParser || {};

  const CATEGORY_MAP = {
    FIRST_NAME: (p) => p.personal?.firstName,
    MIDDLE_NAME: (p) => p.personal?.middleName,
    LAST_NAME: (p) => p.personal?.lastName,
    PREFERRED_NAME: (p) => p.personal?.preferredName,
    FULL_NAME: (p) => `${p.personal?.firstName || ''} ${p.personal?.lastName || ''}`.trim(),
    EMAIL: (p) => p.personal?.email,
    PHONE: (p) => p.personal?.phone,
    BIRTHDAY: (p) => p.personal?.birthday,
    GENDER: (p) => p.personal?.gender,
    PRONOUNS: (p) => p.personal?.pronouns,
    ADDRESS_LINE_1: (p) => p.personal?.address?.line1,
    ADDRESS_LINE_2: (p) => p.personal?.address?.line2,
    CITY: (p) => p.personal?.address?.city,
    STATE: (p) => p.personal?.address?.state,
    ZIP: (p) => p.personal?.address?.zip,
    COUNTRY: (p) => p.personal?.address?.country,
    LINKEDIN: (p) => p.professional?.linkedin,
    GITHUB: (p) => p.professional?.github,
    PORTFOLIO: (p) => p.professional?.portfolio,
    CURRENT_COMPANY: (p) => p.professional?.currentCompany,
    CURRENT_TITLE: (p) => p.professional?.currentTitle,
    YEARS_OF_EXPERIENCE: (p) => p.professional?.yearsOfExperience,
    UNIVERSITY: (p) => p.education?.university,
    DEGREE: (p) => p.education?.degree,
    FACULTY: (p) => p.education?.faculty,
    FIELD_OF_STUDY: (p) => p.education?.fieldOfStudy,
    STUDENT_LEVEL: (p) => p.education?.studentLevel,
    GPA: (p) => p.education?.gpa,
    GRADUATION_YEAR: (p) => p.education?.graduationYear,
    SALARY_EXPECTATION: (p) => p.preferences?.salaryExpectation,
    START_DATE: (p) => p.preferences?.startDate,
    NOTICE_PERIOD: (p) => p.preferences?.noticePeriod,
    RELOCATION: (p) => p.preferences?.relocation,
    TRAVEL_PERCENTAGE: (p) => p.preferences?.travelPercentage,
    LANGUAGES: (p) => p.preferences?.languages,
    SKILLS: (p) => p.professional?.skills,
    WORK_AUTHORIZATION: (p) => p.preferences?.workAuthorization
  };

  async function extractFields() {
    console.log('[AutoFill] Starting field extraction...');
    let allModels = [];
    let processed = new Set();
    
    if (scanA11y) {
      const a11yResult = await scanA11y(document);
      allModels.push(...a11yResult.models);
      a11yResult.processedElements.forEach(el => processed.add(el));
    }
    
    if (scanSemantic) {
      const semanticModels = await scanSemantic(document, processed);
      allModels.push(...semanticModels);
    }
    
    console.log(`[AutoFill] Extracted ${allModels.length} fields.`);
    return allModels;
  }

  function getProfileValueForCategory(category, profile) {
    if (!profile) return '';
    const eeoCategories = ['ETHNICITY', 'VETERAN_STATUS', 'DISABILITY_STATUS'];
    if (eeoCategories.includes(category)) return '';

    if (CATEGORY_MAP[category]) {
      return CATEGORY_MAP[category](profile) || '';
    }
    return '';
  }

  async function fillField(element, value, inputType, fieldMeta = null) {
    if (value === null || value === undefined || value === '' || element.disabled) return { success: false, tier: null };
    const filler = globalThis.FillerFactory.getFiller();

    // ── Multi-select checkbox-group ──────────────────────────────────────────
    if (inputType === 'checkbox-group') {
      if (!fieldMeta || !fieldMeta.options) return { success: false, tier: null };
      
      // Normalize value to an array of strings (handle comma-separated strings or JS arrays)
      const rawValues = Array.isArray(value)
        ? value
        : String(value).split(',').map(v => v.trim()).filter(Boolean);

      let anyMatched = false;
      for (const raw of rawValues) {
        const lowerRaw = raw.toLowerCase();
        const matchIndex = fieldMeta.options.findIndex(o => o.toLowerCase().includes(lowerRaw) || lowerRaw.includes(o.toLowerCase()));
        if (matchIndex !== -1 && fieldMeta.radioElements[matchIndex]) {
          filler.click(fieldMeta.radioElements[matchIndex]);
          anyMatched = true;
        }
      }
      return { success: anyMatched, tier: anyMatched ? 1 : null };
    }

    // ── Single-select radio-group ────────────────────────────────────────────
    if (inputType === 'radio-group') {
       const lowerVal = String(value).toLowerCase();
       let matchIndex = -1;
       if (fieldMeta && fieldMeta.options) {
          matchIndex = fieldMeta.options.findIndex(o => o.toLowerCase().includes(lowerVal) || lowerVal.includes(o.toLowerCase().replace(/\s+/g, ' ').trim()));
       }
       if (matchIndex !== -1 && fieldMeta.radioElements[matchIndex]) {
          filler.click(fieldMeta.radioElements[matchIndex]);
          return { success: true, tier: 1 };
       } else {
          // Fallback to "Other" option if the desired value is not strictly listed
          let otherIndex = fieldMeta.options.findIndex(o => {
              const text = o.toLowerCase().trim();
              return text === 'other' || text.startsWith('other:') || text.includes('please specify');
          });
          
          if (otherIndex !== -1 && fieldMeta.radioElements[otherIndex]) {
             const otherRadio = fieldMeta.radioElements[otherIndex];
             filler.click(otherRadio);
             
             let otherTextInput = fieldMeta.otherTextInput;
             if (!otherTextInput) {
                // Wait briefly in case a React SPA conditionally renders the text input
                await new Promise(r => setTimeout(r, 150));
                let current = otherRadio.parentElement;
                for (let i = 0; i < 5 && current && current.tagName !== 'BODY'; i++) {
                    const texts = current.querySelectorAll('input:not([type="radio"]):not([type="checkbox"]):not([type="hidden"]), textarea, [role="textbox"]');
                    if (texts.length > 0) {
                        otherTextInput = texts[texts.length - 1];
                        break;
                    }
                    current = current.parentElement;
                }
             }
             
             if (otherTextInput) {
                filler.setValue(otherTextInput, value);
                return { success: true, tier: 1 };
             }
          }
       }
       return { success: false, tier: null };
    }

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
    }

    filler.setValue(element, value);
    return { success: true, tier: 1 };
  }

  return { extractFields, getProfileValueForCategory, fillField };
})();
