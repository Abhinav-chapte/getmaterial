// IndexedDB for offline file storage — Spotify-like approach
const DB_NAME = 'GetNotesOfflineDB';
const STORE_NAME = 'downloads';
const DB_VERSION = 2;

// Request persistent storage so browser doesn't evict our files
export const requestPersistentStorage = async () => {
  try {
    if (navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persist();
      console.log(`Persistent storage: ${isPersisted ? 'granted' : 'denied'}`);
      return isPersisted;
    }
  } catch (err) {
    console.warn('Persistent storage request failed:', err);
  }
  return false;
};

// Check storage quota
export const getStorageEstimate = async () => {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const { usage, quota } = await navigator.storage.estimate();
      return {
        used: usage,
        total: quota,
        usedMB: (usage / 1024 / 1024).toFixed(1),
        totalMB: (quota / 1024 / 1024).toFixed(1),
        percentUsed: ((usage / quota) * 100).toFixed(1),
      };
    }
  } catch (err) {
    console.warn('Storage estimate failed:', err);
  }
  return null;
};

const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      // Delete old store if exists (version upgrade)
      if (db.objectStoreNames.contains('downloads')) {
        db.deleteObjectStore('downloads');
      }
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'noteId' });
      store.createIndex('downloadedAt', 'downloadedAt', { unique: false });
    };
  });
};

// Save file to IndexedDB
export const saveFileOffline = async (noteId, fileBlob, noteData) => {
  try {
    // Request persistent storage every time we save (browser may grant it)
    await requestPersistentStorage();

    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Store blob with correct type preserved
    const mimeType = noteData?.fileType || fileBlob.type || 'application/octet-stream';
    const typedBlob = new Blob([fileBlob], { type: mimeType });

    const data = {
      noteId,
      fileBlob: typedBlob,
      noteData: {
        ...noteData,
        fileType: mimeType,
      },
      downloadedAt: new Date().toISOString(),
      fileSize: fileBlob.size,
    };

    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => {
        console.log(`✅ Saved offline: ${noteData?.title} (${(fileBlob.size / 1024 / 1024).toFixed(2)} MB)`);
        resolve(true);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error saving file offline:', error);
    throw error;
  }
};

// Get file from IndexedDB
export const getOfflineFile = async (noteId) => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
      const request = store.get(noteId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error getting offline file:', error);
    return null;
  }
};

// Get all offline files
export const getAllOfflineFiles = async () => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error getting all offline files:', error);
    return [];
  }
};

// Delete offline file
export const deleteOfflineFile = async (noteId) => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
      const request = store.delete(noteId);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error deleting offline file:', error);
    throw error;
  }
};

// Check if file is available offline
export const isFileAvailableOffline = async (noteId) => {
  const file = await getOfflineFile(noteId);
  return !!file;
};

// Clear all offline files
export const clearAllOfflineFiles = async () => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error clearing offline files:', error);
    throw error;
  }
};

// Get total storage size used by offline files
export const getOfflineStorageSize = async () => {
  try {
    const files = await getAllOfflineFiles();
    return files.reduce((total, f) => total + (f.fileSize || f.fileBlob?.size || 0), 0);
  } catch (error) {
    return 0;
  }
};

export const getOfflineFileCount = async () => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    return 0;
  }
};