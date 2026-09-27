import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { TABLES, COLUMNS } from '../lib/schema';

const normalizeItems = (rows = []) =>
  rows.map((item) => ({
    id: item[COLUMNS.SHOPPING_ITEMS.ID],
    listId: item[COLUMNS.SHOPPING_ITEMS.LIST_ID],
    name: item[COLUMNS.SHOPPING_ITEMS.NAME],
    quantity: Number(item[COLUMNS.SHOPPING_ITEMS.QUANTITY]),
    unit: item[COLUMNS.SHOPPING_ITEMS.UNIT],
    bought: item[COLUMNS.SHOPPING_ITEMS.BOUGHT],
    category: item[COLUMNS.SHOPPING_ITEMS.CATEGORY],
    notes: item[COLUMNS.SHOPPING_ITEMS.NOTES],
    createdBy: item[COLUMNS.SHOPPING_ITEMS.CREATED_BY],
    createdAt: item[COLUMNS.SHOPPING_ITEMS.CREATED_AT],
  }));

const normalizeLists = (rows = []) =>
  rows.map((list) => ({
    id: list[COLUMNS.SHOPPING_LISTS.ID],
    name: list[COLUMNS.SHOPPING_LISTS.NAME],
    description: list[COLUMNS.SHOPPING_LISTS.DESCRIPTION],
    ownerId: list[COLUMNS.SHOPPING_LISTS.OWNER_ID],
    createdAt: list[COLUMNS.SHOPPING_LISTS.CREATED_AT],
  }));

export function useShoppingList(session, ensureProfile) {
  const [items, setItems] = useState([]);
  const [lists, setLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState(null);
  const [loadingItems, setLoadingItems] = useState(true);
  const [error, setError] = useState('');

  const summary = useMemo(() => {
    const total = items.length;
    const bought = items.filter((item) => item.bought).length;
    return { total, bought, remaining: total - bought };
  }, [items]);

  const refreshItems = useCallback(async (listId) => {
    if (!supabase || !listId) {
      setItems([]);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from(TABLES.SHOPPING_ITEMS)
      .select('*')
      .eq(COLUMNS.SHOPPING_ITEMS.LIST_ID, listId)
      .order(COLUMNS.SHOPPING_ITEMS.CREATED_AT, { ascending: false });

    if (fetchError) {
      setError(fetchError.message || 'Impossibile caricare i prodotti.');
      return;
    }

    setItems(normalizeItems(data));
  }, []);

  useEffect(() => {
    if (!supabase || !session) {
      setSelectedListId(null);
      setLists([]);
      setItems([]);
      setLoadingItems(false);
      return;
    }

    const initializeData = async () => {
      try {
        setLoadingItems(true);
        setError('');

        await ensureProfile(session.user);

        const { data: listData, error: listError } = await supabase
          .from(TABLES.SHOPPING_LISTS)
          .select('*')
          .eq(COLUMNS.SHOPPING_LISTS.OWNER_ID, session.user.id)
          .order(COLUMNS.SHOPPING_LISTS.CREATED_AT, { ascending: false });

        if (listError) throw listError;

        // Conta gli elementi per ogni lista
        const { data: countData, error: countError } = await supabase
          .from(TABLES.SHOPPING_ITEMS)
          .select(COLUMNS.SHOPPING_ITEMS.LIST_ID);

        const itemCounts = {};
        if (!countError && countData) {
          countData.forEach((row) => {
            const listId = row[COLUMNS.SHOPPING_ITEMS.LIST_ID];
            itemCounts[listId] = (itemCounts[listId] || 0) + 1;
          });
        }

        const listsWithCounts = normalizeLists(listData || []).map((list) => ({
          ...list,
          itemCount: itemCounts[list.id] || 0,
        }));

        let activeListId = listsWithCounts[0]?.id ?? null;

        if (!listData || listData.length === 0) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from(TABLES.SHOPPING_LISTS)
            .insert([{
              [COLUMNS.SHOPPING_LISTS.NAME]: 'Lista della spesa',
              [COLUMNS.SHOPPING_LISTS.DESCRIPTION]: 'Lista personale',
              [COLUMNS.SHOPPING_LISTS.OWNER_ID]: session.user.id,
            }])
            .select('*')
            .single();

          if (fallbackError) throw fallbackError;
          const normalized = normalizeLists([fallbackData])[0];
          setLists([{ ...normalized, itemCount: 0 }]);
          activeListId = normalized.id;
        } else {
          setLists(listsWithCounts);
        }

        setSelectedListId(activeListId);
        await refreshItems(activeListId);
      } catch (err) {
        setSelectedListId(null);
        setItems([]);
        setError(err.message || 'Impossibile caricare la lista.');
      } finally {
        setLoadingItems(false);
      }
    };

    initializeData();
  }, [session, ensureProfile, refreshItems]);

  const addItem = useCallback(
    async ({ listId, name, quantity, unit, category, notes, userId }) => {
      const cleanName = name.trim();
      if (!cleanName || !supabase || !session || !listId) {
        setError('Non riesco a trovare la tua lista. Ricarica la pagina.');
        return false;
      }

      const { error: insertError } = await supabase.from(TABLES.SHOPPING_ITEMS).insert([{
        [COLUMNS.SHOPPING_ITEMS.LIST_ID]: listId,
        [COLUMNS.SHOPPING_ITEMS.NAME]: cleanName,
        [COLUMNS.SHOPPING_ITEMS.QUANTITY]: Number(quantity) || 1,
        [COLUMNS.SHOPPING_ITEMS.UNIT]: unit,
        [COLUMNS.SHOPPING_ITEMS.BOUGHT]: false,
        [COLUMNS.SHOPPING_ITEMS.CATEGORY]: category || null,
        [COLUMNS.SHOPPING_ITEMS.NOTES]: notes || null,
        [COLUMNS.SHOPPING_ITEMS.CREATED_BY]: userId,
      }]);

      if (insertError) {
        setError(insertError.message || "Errore durante l'aggiunta del prodotto.");
        return false;
      }

      setError('');
      await refreshItems(listId);
      return true;
    },
    [session, refreshItems]
  );

  const toggleItem = useCallback(
    async (id) => {
      const item = items.find((entry) => entry.id === id);
      if (!item || !supabase || !selectedListId) return;

      const { error: updateError } = await supabase
        .from(TABLES.SHOPPING_ITEMS)
        .update({ [COLUMNS.SHOPPING_ITEMS.BOUGHT]: !item.bought })
        .eq(COLUMNS.SHOPPING_ITEMS.ID, id);

      if (!updateError) {
        setItems((current) =>
          current.map((entry) => (entry.id === id ? { ...entry, bought: !entry.bought } : entry))
        );
      }
    },
    [items, selectedListId]
  );

  const removeItem = useCallback(
    async (id) => {
      if (!supabase || !selectedListId) return;

      const { error: deleteError } = await supabase
        .from(TABLES.SHOPPING_ITEMS)
        .delete()
        .eq(COLUMNS.SHOPPING_ITEMS.ID, id);

      if (!deleteError) {
        setItems((current) => current.filter((item) => item.id !== id));
      }
    },
    [selectedListId]
  );

  const createList = useCallback(
    async (name) => {
      if (!supabase || !session) return null;

      const trimmedName = name.trim();
      if (!trimmedName) {
        setError('Inserisci un nome per la nuova lista.');
        return null;
      }

      setError('');
      const { data: createdList, error: insertError } = await supabase
        .from(TABLES.SHOPPING_LISTS)
        .insert([{
          [COLUMNS.SHOPPING_LISTS.NAME]: trimmedName,
          [COLUMNS.SHOPPING_LISTS.DESCRIPTION]: 'Lista personale',
          [COLUMNS.SHOPPING_LISTS.OWNER_ID]: session.user.id,
        }])
        .select('*')
        .single();

      if (insertError) {
        setError(insertError.message || 'Impossibile creare la nuova lista.');
        return null;
      }

      const normalized = { ...normalizeLists([createdList])[0], itemCount: 0 };
      setLists((current) => [normalized, ...current]);
      setSelectedListId(normalized.id);
      setItems([]);
      return normalized;
    },
    [session]
  );

  const switchList = useCallback(
    (listId) => {
      setSelectedListId(listId);
      setItems([]);
      refreshItems(listId);
    },
    [refreshItems]
  );

  const deleteList = useCallback(
    async (listId) => {
      if (!supabase || !session) return false;

      const { error: deleteError } = await supabase
        .from(TABLES.SHOPPING_LISTS)
        .delete()
        .eq(COLUMNS.SHOPPING_LISTS.ID, listId);

      if (deleteError) {
        setError(deleteError.message || 'Impossibile eliminare la lista.');
        return false;
      }

      setLists((current) => current.filter((l) => l.id !== listId));
      if (selectedListId === listId) {
        setSelectedListId(null);
        setItems([]);
      }
      return true;
    },
    [session, selectedListId]
  );

  return {
    items,
    lists,
    selectedListId,
    loadingItems,
    error,
    setError,
    summary,
    addItem,
    toggleItem,
    removeItem,
    createList,
    switchList,
    deleteList,
  };
}
