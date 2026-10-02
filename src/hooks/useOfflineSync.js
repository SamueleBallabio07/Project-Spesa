import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { TABLES, COLUMNS } from '../lib/schema';

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
  const syncingRef = useRef(false);

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

  const applyChange = useCallback(async (change) => {
    if (!supabase) return false;

    try {
      switch (change.type) {
        case 'addItem': {
          const { listId, name, quantity, unit, category, notes, userId, kcal100g, protein100g, carbs100g, fat100g, fiber100g } = change.payload;
          const { error } = await supabase.from(TABLES.SHOPPING_ITEMS).insert([{
            [COLUMNS.SHOPPING_ITEMS.LIST_ID]: listId,
            [COLUMNS.SHOPPING_ITEMS.NAME]: name,
            [COLUMNS.SHOPPING_ITEMS.QUANTITY]: quantity,
            [COLUMNS.SHOPPING_ITEMS.UNIT]: unit,
            [COLUMNS.SHOPPING_ITEMS.BOUGHT]: false,
            [COLUMNS.SHOPPING_ITEMS.CATEGORY]: category || null,
            [COLUMNS.SHOPPING_ITEMS.NOTES]: notes || null,
            [COLUMNS.SHOPPING_ITEMS.KCAL100G]: kcal100g ?? null,
            [COLUMNS.SHOPPING_ITEMS.PROTEIN100G]: protein100g ?? null,
            [COLUMNS.SHOPPING_ITEMS.CARBS100G]: carbs100g ?? null,
            [COLUMNS.SHOPPING_ITEMS.FAT100G]: fat100g ?? null,
            [COLUMNS.SHOPPING_ITEMS.FIBER100G]: fiber100g ?? null,
            [COLUMNS.SHOPPING_ITEMS.CREATED_BY]: userId,
          }]);
          return !error;
        }
        case 'toggleItem': {
          const { id, bought } = change.payload;
          const { error } = await supabase
            .from(TABLES.SHOPPING_ITEMS)
            .update({ [COLUMNS.SHOPPING_ITEMS.BOUGHT]: bought })
            .eq(COLUMNS.SHOPPING_ITEMS.ID, id);
          return !error;
        }
        case 'removeItem': {
          const { id } = change.payload;
          const { error } = await supabase
            .from(TABLES.SHOPPING_ITEMS)
            .delete()
            .eq(COLUMNS.SHOPPING_ITEMS.ID, id);
          return !error;
        }
        case 'updateItem': {
          const { id, updates } = change.payload;
          const { error } = await supabase
            .from(TABLES.SHOPPING_ITEMS)
            .update(updates)
            .eq(COLUMNS.SHOPPING_ITEMS.ID, id);
          return !error;
        }
        case 'createList': {
          const { name, userId } = change.payload;
          const { data, error } = await supabase
            .from(TABLES.SHOPPING_LISTS)
            .insert([{
              [COLUMNS.SHOPPING_LISTS.NAME]: name,
              [COLUMNS.SHOPPING_LISTS.DESCRIPTION]: 'Lista personale',
              [COLUMNS.SHOPPING_LISTS.OWNER_ID]: userId,
            }])
            .select('*')
            .single();
          return !error && data;
        }
        case 'deleteList': {
          const { id } = change.payload;
          const { error } = await supabase
            .from(TABLES.SHOPPING_LISTS)
            .delete()
            .eq(COLUMNS.SHOPPING_LISTS.ID, id);
          return !error;
        }
        default:
          console.warn('Tipo cambiamento sconosciuto:', change.type);
          return false;
      }
    } catch (error) {
      console.error('Errore applicazione cambiamento:', error);
      return false;
    }
  }, []);

  const syncPendingData = useCallback(async () => {
    if (!dbRef.current || !navigator.onLine || syncingRef.current) return;
    
    syncingRef.current = true;
    setSyncing(true);

    try {
      const transaction = dbRef.current.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      const changes = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (changes.length === 0) return;

      // Applica i cambiamenti in ordine cronologico
      let successCount = 0;
      for (const change of changes) {
        const success = await applyChange(change);
        if (success) {
          successCount++;
        } else {
          console.error('Fallito sync per:', change);
          // Non fermare: prova i successivi
        }
      }

      // Rimuovi solo i cambiamenti applicati con successo
      if (successCount > 0) {
        const clearTransaction = dbRef.current.transaction(STORE_NAME, 'readwrite');
        const clearStore = clearTransaction.objectStore(STORE_NAME);
        
        // Elimina uno per uno per sicurezza (solo quelli riusciti)
        for (const change of changes.slice(0, successCount)) {
          await clearStore.delete(change.id);
        }
        await updatePendingCount();
      }
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [applyChange]);

  return {
    isOnline,
    pendingChanges,
    syncing,
    saveChange,
    syncPendingData,
  };
}
