// IndexedDB for offline file storage
const DB_NAME = 'GetMaterialDB';
const STORE_NAME = 'downloads';
const DB_VERSION = 1;

// Open or create database
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'noteId' });
      }
    };
  });
};

// Save file to IndexedDB for offline access
export const saveFileOffline = async (noteId, fileBlob, noteData) => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const data = {
      noteId,
      fileBlob,
      noteData,
      downloadedAt: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve(true);
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
      request.onsuccess = () => resolve(request.result);
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
      request.onsuccess = () => resolve(request.result);
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