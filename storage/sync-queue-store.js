globalThis.SyncQueueStore = (function() {
  const QUEUE_KEY = 'datasetSyncQueue';
  const API_KEY_KEY = 'syncApiKey';

  async function getApiKey() {
    return new Promise((resolve) => {
      chrome.storage.local.get([API_KEY_KEY], (res) => {
        if (res[API_KEY_KEY]) {
          resolve(res[API_KEY_KEY]);
        } else {
          const newKey = 'ext_' + crypto.randomUUID();
          chrome.storage.local.set({ [API_KEY_KEY]: newKey }, () => resolve(newKey));
        }
      });
    });
  }

  async function getQueue() {
    return new Promise((resolve) => {
      chrome.storage.local.get([QUEUE_KEY], (res) => {
        resolve(res[QUEUE_KEY] || []);
      });
    });
  }

  async function saveQueue(queue) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [QUEUE_KEY]: queue }, resolve);
    });
  }

  async function enqueue(records) {
    let queue = await getQueue();
    queue.push({
      id: crypto.randomUUID(),
      records,
      attemptedAt: null,
      retryCount: 0
    });
    
    if (queue.length > 500) {
      console.warn('[SyncQueue] Queue size exceeded 500. Discarding oldest batch.');
      queue.shift();
    }
    await saveQueue(queue);
  }

  async function removeBatch(batchId) {
    let queue = await getQueue();
    queue = queue.filter(b => b.id !== batchId);
    await saveQueue(queue);
  }

  async function incrementRetry(batchId) {
    let queue = await getQueue();
    const batchIndex = queue.findIndex(b => b.id === batchId);
    if (batchIndex !== -1) {
      queue[batchIndex].retryCount += 1;
      queue[batchIndex].attemptedAt = new Date().toISOString();
      if (queue[batchIndex].retryCount >= 3) {
        console.warn(`[SyncQueue] Batch ${batchId} failed 3 times. Discarding.`);
        queue.splice(batchIndex, 1);
      }
    }
    await saveQueue(queue);
  }

  return { enqueue, getQueue, removeBatch, incrementRetry, getApiKey };
})();
