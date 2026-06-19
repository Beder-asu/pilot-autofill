globalThis.IndexedDBStore = (function() {
  const DB_NAME = 'AutofillDB';
  const DB_VERSION = 2;

  let dbPromise = null;

  function getDB() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          
          if (!db.objectStoreNames.contains('fileLibrary')) {
            db.createObjectStore('fileLibrary', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('fileBuffers')) {
            db.createObjectStore('fileBuffers');
          }
          if (!db.objectStoreNames.contains('dataset')) {
            const datasetStore = db.createObjectStore('dataset', { keyPath: 'id', autoIncrement: true });
            datasetStore.createIndex('recordedAt', 'recordedAt', { unique: false });
          }
        };

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => {
          console.error('[AutoFill] IndexedDB init error:', event.target.error);
          reject(event.target.error);
        };
      });
    }
    return dbPromise;
  }

  async function getFileLibrary() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['fileLibrary'], 'readonly');
      const req = tx.objectStore('fileLibrary').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getFileBuffer(id) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['fileBuffers'], 'readonly');
      const req = tx.objectStore('fileBuffers').get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function saveFile(fileLibraryEntry, arrayBuffer) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['fileLibrary', 'fileBuffers'], 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);

      const libStore = tx.objectStore('fileLibrary');
      const bufStore = tx.objectStore('fileBuffers');

      if (fileLibraryEntry.isDefaultForType) {
        const req = libStore.getAll();
        req.onsuccess = () => {
          req.result.forEach(file => {
            if (file.typeTag === fileLibraryEntry.typeTag && file.id !== fileLibraryEntry.id && file.isDefaultForType) {
              file.isDefaultForType = false;
              libStore.put(file);
            }
          });
          libStore.put(fileLibraryEntry);
          bufStore.put(arrayBuffer, fileLibraryEntry.id);
        };
      } else {
        libStore.put(fileLibraryEntry);
        bufStore.put(arrayBuffer, fileLibraryEntry.id);
      }
    });
  }

  async function deleteFile(id) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['fileLibrary', 'fileBuffers'], 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore('fileLibrary').delete(id);
      tx.objectStore('fileBuffers').delete(id);
    });
  }
  
  async function updateFileMetadata(fileLibraryEntry) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['fileLibrary'], 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      const libStore = tx.objectStore('fileLibrary');
      
      if (fileLibraryEntry.isDefaultForType) {
        const req = libStore.getAll();
        req.onsuccess = () => {
          req.result.forEach(file => {
            if (file.typeTag === fileLibraryEntry.typeTag && file.id !== fileLibraryEntry.id && file.isDefaultForType) {
              file.isDefaultForType = false;
              libStore.put(file);
            }
          });
          libStore.put(fileLibraryEntry);
        };
      } else {
        libStore.put(fileLibraryEntry);
      }
    });
  }

  async function addDatasetRecord(record) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['dataset'], 'readwrite');
      const req = tx.objectStore('dataset').add(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getDatasetRecords() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['dataset'], 'readonly');
      const req = tx.objectStore('dataset').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function clearAllData() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['fileLibrary', 'fileBuffers', 'dataset'], 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore('fileLibrary').clear();
      tx.objectStore('fileBuffers').clear();
      tx.objectStore('dataset').clear();
    });
  }

  async function migrateV1toV2() {
    const db = await getDB();
    const hasResumes = db.objectStoreNames.contains('resumes');
    const hasCoverLetters = db.objectStoreNames.contains('coverLetters');
    
    if (!hasResumes && !hasCoverLetters) return;

    return new Promise((resolve, reject) => {
      const stores = ['fileLibrary', 'fileBuffers'];
      if (hasResumes) stores.push('resumes');
      if (hasCoverLetters) stores.push('coverLetters');

      const tx = db.transaction(stores, 'readwrite');
      tx.oncomplete = () => {
        console.log('[AutoFill] V1 to V2 Migration completed.');
        resolve();
      };
      tx.onerror = () => reject(tx.error);

      const libStore = tx.objectStore('fileLibrary');
      const bufStore = tx.objectStore('fileBuffers');

      const migrateStore = (storeName, typeTag) => {
        const oldStore = tx.objectStore(storeName);
        const req = oldStore.getAll();
        req.onsuccess = () => {
          req.result.forEach((item, index) => {
            const newId = `migrated-${storeName}-${Date.now()}-${index}`;
            
            // Reconstruct V2 file metadata
            const fileMeta = {
              id: newId,
              displayName: item.name || `${typeTag} File`,
              originalFileName: item.name || `${typeTag}.pdf`,
              mimeType: item.type || 'application/pdf',
              typeTag: typeTag,
              isDefaultForType: index === 0, // make first one default
              addedAt: new Date().toISOString()
            };

            // Assuming V1 stored buffer directly or as { buffer, name }
            const buffer = item.buffer || item;

            libStore.put(fileMeta);
            bufStore.put(buffer, newId);
          });
        };
      };

      if (hasResumes) migrateStore('resumes', 'RESUME');
      if (hasCoverLetters) migrateStore('coverLetters', 'COVER_LETTER');
    });
  }

  return {
    getFileLibrary, getFileBuffer, saveFile, deleteFile,
    updateFileMetadata, addDatasetRecord, getDatasetRecords, clearAllData, migrateV1toV2
  };
})();
