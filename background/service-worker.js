importScripts('../storage/indexeddb-store.js');
importScripts('../storage/sync-queue-store.js');

const EXPECTED_SCHEMA_VERSION = 2;

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.local.set({ schemaVersion: EXPECTED_SCHEMA_VERSION, syncEnabled: false, autoFillMode: false });
    console.log('Autofill Extension installed. Schema version set to', EXPECTED_SCHEMA_VERSION);
    chrome.tabs.create({ url: 'settings/settings.html?onboarding=true' });
  } else if (details.reason === 'update') {
    await runMigrations();
  }
});

async function runMigrations() {
  const data = await chrome.storage.local.get('schemaVersion');
  const storedVersion = data.schemaVersion || 1;

  if (storedVersion < EXPECTED_SCHEMA_VERSION) {
    console.log(`Migrating schema from v${storedVersion} to v${EXPECTED_SCHEMA_VERSION}`);
    if (storedVersion === 1) {
      await migrateV1toV2();
    }
    await chrome.storage.local.set({ schemaVersion: EXPECTED_SCHEMA_VERSION });
  }
}

async function migrateV1toV2() {
  console.log('[AutoFill] Triggering V1 to V2 IndexedDB Migration...');
  try {
    await globalThis.IndexedDBStore.migrateV1toV2();
  } catch (e) {
    console.error('[AutoFill] Migration failed:', e);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_FILE_LIBRARY') {
    globalThis.IndexedDBStore.getFileLibrary().then(sendResponse);
    return true;
  }
  if (request.action === 'GET_FILE_BUFFER') {
    globalThis.IndexedDBStore.getFileBuffer(request.fileId).then(buffer => {
      globalThis.IndexedDBStore.getFileLibrary().then(library => {
        const entry = library.find(f => f.id === request.fileId);
        if (buffer && entry) {
          const array = Array.from(new Uint8Array(buffer));
          sendResponse({ buffer: array, entry });
        } else {
          sendResponse({ error: 'Not found' });
        }
      }).catch(e => sendResponse({ error: e.message }));
    }).catch(e => sendResponse({ error: e.message }));
    return true;
  }
  if (request.action === 'LOG_DATASET_RECORD') {
    globalThis.IndexedDBStore.addDatasetRecord(request.record).then(() => {
      chrome.storage.local.get(['syncEnabled'], (res) => {
        if (res.syncEnabled) {
          globalThis.SyncQueueStore.enqueue([request.record]).then(debouncedSyncDataset);
        }
      });
      sendResponse({ success: true });
    });
    return true;
  }
  if (request.action === 'OPEN_SETTINGS') {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return true;
  }
  if (request.action === 'GENERATE_ESSAY') {
    chrome.storage.local.get(['aiProvider', 'aiModel', 'aiApiKey', 'geminiApiKey'], async (res) => {
      const apiKey = res.aiApiKey || res.geminiApiKey;
      const provider = res.aiProvider || 'gemini';
      const model = res.aiModel || 'gemini-2.5-flash';

      if (!apiKey) {
        sendResponse({ error: 'MISSING_API_KEY' });
        return;
      }
      try {
        const prompt = `You are an expert career assistant. Answer the following job application essay question on behalf of the applicant.
Use the provided JSON profile as background context, but you MUST strictly follow and prioritize the "USER NOTES FOR THIS QUESTION" if provided. The user notes may contain specific guidelines, constraints, or a pseudo-answer that you need to flesh out and format.
Return ONLY the text of the answer. Do not include quotes or formatting.

GLOBAL INSTRUCTIONS:
${request.globalInstructions || 'None'}

USER NOTES FOR THIS QUESTION:
${request.notes || 'None'}

USER PROFILE:
${JSON.stringify(request.profile, null, 2)}

QUESTION:
${request.question}
`;
        let text = '';

        if (provider === 'gemini') {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.7 }
            })
          });
          const data = await response.json();
          if (data.error) throw new Error(data.error.message);
          text = data.candidates[0].content.parts[0].text.trim();

        } else if (provider === 'openai') {
          const response = await fetch(`https://api.openai.com/v1/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: model,
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.7
            })
          });
          const data = await response.json();
          if (data.error) throw new Error(data.error.message);
          text = data.choices[0].message.content.trim();

        } else if (provider === 'anthropic') {
          const response = await fetch(`https://api.anthropic.com/v1/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'anthropic-dangerously-allow-urls': 'true'
            },
            body: JSON.stringify({
              model: model,
              max_tokens: 1024,
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.7
            })
          });
          const data = await response.json();
          if (data.error) throw new Error(data.error.message);
          text = data.content[0].text.trim();
        }

        sendResponse({ text });
      } catch (e) {
        sendResponse({ error: e.message });
      }
    });
    return true;
  }

  if (request.action === 'CLASSIFY_FIELD') {
    chrome.storage.local.get(['aiProvider', 'aiModel', 'aiApiKey', 'geminiApiKey'], async (res) => {
      const apiKey = res.aiApiKey || res.geminiApiKey;
      const provider = res.aiProvider || 'gemini';
      const model = res.aiModel || 'gemini-2.5-flash';

      if (!apiKey) {
        sendResponse({ error: 'MISSING_API_KEY' });
        return;
      }
      try {
        const prompt = `You are an AI assistant helping to autofill web forms. 
Given the following context about a form field, classify it into exactly ONE of the following categories:
FIRST_NAME, LAST_NAME, EMAIL, PHONE, ADDRESS_LINE_1, CITY, STATE, ZIP, COUNTRY, LINKEDIN, PORTFOLIO, RESUME, COVER_LETTER_TEXT, ESSAY_QUESTION, YEARS_OF_EXPERIENCE, CURRENT_COMPANY, CURRENT_TITLE, GRADUATION_YEAR, DEGREE, UNIVERSITY, FIELD_OF_STUDY, GPA, NATIONAL_ID, GENDER, SALARY_EXPECTATION, START_DATE, LANGUAGES, SKILLS.
If it doesn't match any, return UNKNOWN.

Field Context:
${request.context}

Respond ONLY with the exact category name. Nothing else.`;

        let category = 'UNKNOWN';

        if (provider === 'gemini') {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.1 }
            })
          });
          const data = await response.json();
          if (data.error) throw new Error(data.error.message);
          category = data.candidates[0].content.parts[0].text.trim();
        } else if (provider === 'openai') {
          const response = await fetch(`https://api.openai.com/v1/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: model,
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.1
            })
          });
          const data = await response.json();
          if (data.error) throw new Error(data.error.message);
          category = data.choices[0].message.content.trim();
        }

        // Clean up the output in case the LLM was chatty
        category = category.replace(/[^A-Z_]/g, '');

        sendResponse({ category });
      } catch (e) {
        sendResponse({ error: e.message });
      }
    });
    return true;
  }
});

let syncTimeout = null;
function debouncedSyncDataset() {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    syncDataset();
  }, 5000);
}

async function syncDataset() {
  const queue = await globalThis.SyncQueueStore.getQueue();
  if (queue.length === 0) return;

  const apiKey = await globalThis.SyncQueueStore.getApiKey();

  for (const batch of queue) {
    try {
      const response = await fetch('https://pilot-autofill.com/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          records: batch.records
        })
      });

      if (response.ok) {
        await globalThis.SyncQueueStore.removeBatch(batch.id);
      } else if (response.status === 429) {
        console.warn('Sync rate limit hit. Pausing sync.');
        break;
      } else {
        await globalThis.SyncQueueStore.incrementRetry(batch.id);
      }
    } catch (e) {
      console.error('Sync failed', e);
      await globalThis.SyncQueueStore.incrementRetry(batch.id);
      break;
    }
  }
}

chrome.alarms.create('datasetSync', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'datasetSync') {
    chrome.storage.local.get(['syncEnabled'], (res) => {
      if (res.syncEnabled) syncDataset();
    });
  }
});
