const assert = require('node:assert/strict');
const test = require('node:test');

require('../content/classification/rule-based.js');
require('../content/autofill-engine.js');

function field(overrides = {}) {
  return {
    fingerprint: 'test-field',
    tagName: 'INPUT',
    inputType: 'text',
    detectedLanguage: 'en',
    labelText: '',
    ariaLabel: '',
    ariaLabelledby: '',
    placeholder: '',
    value: '',
    autocomplete: '',
    name: '',
    id: '',
    surroundingText: '',
    dataAttributes: {},
    ...overrides,
  };
}

test('classifies an English email label with high confidence', () => {
  const result = globalThis.RuleBasedClassifier.classify(
    field({ labelText: 'Email address' }),
  );

  assert.equal(result.assignedCategory, 'EMAIL');
  assert.equal(result.confidenceBand, 'HIGH');
  assert.equal(result.fillRoute, 'autofill');
});

test('classifies Arabic first-name labels', () => {
  const result = globalThis.RuleBasedClassifier.classify(
    field({ detectedLanguage: 'ar', labelText: 'الاسم الأول' }),
  );

  assert.equal(result.assignedCategory, 'FIRST_NAME');
  assert.equal(result.confidenceBand, 'HIGH');
});

test('routes EEO classifications through explicit review', () => {
  const result = globalThis.RuleBasedClassifier.classify(
    field({ labelText: 'Gender' }),
  );

  assert.equal(result.assignedCategory, 'GENDER');
  assert.equal(result.fillRoute, 'overlay_eeo');
});

test('never returns stored EEO values to the fill path', () => {
  const profile = {
    personal: {
      gender: 'Prefer not to say',
      ethnicity: 'Example',
      veteranStatus: 'Example',
      disabilityStatus: 'Example',
    },
  };

  for (const category of [
    'GENDER',
    'ETHNICITY',
    'VETERAN_STATUS',
    'DISABILITY_STATUS',
  ]) {
    assert.equal(
      globalThis.AutofillEngine.getProfileValueForCategory(category, profile),
      '',
    );
  }
});

test('routes file inputs through explicit file review', () => {
  const result = globalThis.RuleBasedClassifier.classify(
    field({ inputType: 'file' }),
  );

  assert.equal(result.assignedCategory, 'RESUME');
  assert.equal(result.fillRoute, 'overlay_file');
});

test('routes an unknown textarea through essay review instead of autofill', () => {
  const result = globalThis.RuleBasedClassifier.classify(
    field({ tagName: 'TEXTAREA', inputType: 'textarea' }),
  );

  assert.equal(result.assignedCategory, 'ESSAY_QUESTION');
  assert.equal(result.confidenceBand, 'LOW');
  assert.equal(result.fillRoute, 'overlay_cover_letter');
});

test('disabled fields are rejected before a filler is requested', async () => {
  const result = await globalThis.AutofillEngine.fillField(
    { disabled: true },
    'value',
    'text',
  );

  assert.deepEqual(result, { success: false, tier: null });
});
