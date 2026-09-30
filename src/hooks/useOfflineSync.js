import { useState, useEffect, useCallback, useRef } from 'react';

const DB_NAME = 'spesa-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending-changes';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const dbRef = useRef(null);

  // Inizializza IndexedDB
  useEffect(() => {
    openDB().then((db) => {
      dbRef.current = db;
      updatePendingCount();
    }).catch(console.error);
  }, []);

  // Rileva stato online/offline
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingData();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const updatePendingCount = async () => {
    if (!dbRef.current) return;
    const transaction = dbRef.current.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.count();
    request.onsuccess = () => setPendingChanges(request.result);
  };

  const saveChange = useCallback(async (change) => {
    if (!dbRef.current) return;
    const transaction = dbRef.current.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    await store.add({ ...change, timestamp: Date.now() });
    await updatePendingCount();
  }, []);

  const syncPendingData = useCallback(async () => {
    if (!dbRef.current || !navigator.onLine) return;
    setSyncing(true);

    try {
      const transaction = dbRef.current.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      const changes = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      // Qui andrebbe la sincronizzazione con Supabase
      // Per ora svuotiamo il store dopo la "sincronizzazione"
      if (changes.length > 0) {
        const clearTransaction = dbRef.current.transaction(STORE_NAME, 'readwrite');
        const clearStore = clearTransaction.objectStore(STORE_NAME);
        await clearStore.clear();
        await updatePendingCount();
      }
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }
  }, []);

  return {
    isOnline,
    pendingChanges,
    syncing,
    saveChange,
    syncPendingData,
  };
}
