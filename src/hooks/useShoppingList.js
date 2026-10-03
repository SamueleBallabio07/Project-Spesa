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
    kcal100g: item[COLUMNS.SHOPPING_ITEMS.KCAL100G] ?? null,
    protein100g: item[COLUMNS.SHOPPING_ITEMS.PROTEIN100G] ?? null,
    carbs100g: item[COLUMNS.SHOPPING_ITEMS.CARBS100G] ?? null,
    fat100g: item[COLUMNS.SHOPPING_ITEMS.FAT100G] ?? null,
    fiber100g: item[COLUMNS.SHOPPING_ITEMS.FIBER100G] ?? null,
  }));

const normalizeLists = (rows = []) =>
  rows.map((list) => ({
    id: list[COLUMNS.SHOPPING_LISTS.ID],
    name: list[COLUMNS.SHOPPING_LISTS.NAME],
    description: list[COLUMNS.SHOPPING_LISTS.DESCRIPTION],
    ownerId: list[COLUMNS.SHOPPING_LISTS.Owner_ID],
    createdAt: list[COLUMNS.SHOPPING_LISTS.CREATED_AT],
  }));

// Genera ID temporaneo per optimistic updates
const generateTempId = () => `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

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
    async ({
      listId,
      name,
      quantity,
      unit,
      category,
      notes,
      userId,
      // Valori nutrizionali per 100g (opzionali, convenzione USDA)
      kcal100g,
      protein100g,
      carbs100g,
      fat100g,
      fiber100g,
    }) => {
      const cleanName = name.trim();
      if (!cleanName || !supabase || !session || !listId) {
        setError('Non riesco a trovare la tua lista. Ricarica la pagina.');
        return false;
      }

      const normalizedName = cleanName.toLowerCase();

      // OPTIMISTIC UPDATE: aggiungi subito alla UI
      const tempId = generateTempId();
      const optimisticItem = {
        id: tempId,
        listId,
        name: cleanName,
        quantity: Number(quantity) || 1,
        unit: unit || 'pezzi',
        bought: false,
        category: category || null,
        notes: notes || null,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        kcal100g: kcal100g ?? null,
        protein100g: protein100g ?? null,
        carbs100g: carbs100g ?? null,
        fat100g: fat100g ?? null,
        fiber100g: fiber100g ?? null,
        _optimistic: true,
      };

      setItems((current) => [optimisticItem, ...current]);

      try {
        // Usa RPC per logica atomica add_or_update_item
        const { data: rpcResult, error: rpcError } = await supabase.rpc('add_or_update_item', {
          p_list_id: listId,
          p_name: cleanName,
          p_quantity: Number(quantity) || 1,
          p_unit: unit || 'pezzi',
          p_category: category || null,
          p_notes: notes || null,
          p_user_id: userId,
          p_kcal100g: kcal100g ?? null,
          p_protein100g: protein100g ?? null,
          p_carbs100g: carbs100g ?? null,
          p_fat100g: fat100g ?? null,
          p_fiber100g: fiber100g ?? null,
        });

        if (rpcError) throw rpcError;

        const result = rpcResult;
        if (result?.error) throw new Error(result.error);

        // Sostituisci item ottimistico con quello reale
        setItems((current) =>
          current.map((item) =>
            item.id === tempId
              ? { ...item, id: result.item_id, _optimistic: false }
              : item
          )
        );

        // Salva in saved_products (fire-and-forget)
        supabase.rpc('save_product_for_reuse', {
          p_user_id: userId,
          p_name: cleanName,
          p_quantity: Number(quantity) || 1,
          p_unit: unit || 'pezzi',
          p_category: category || null,
          p_notes: notes || null,
          p_kcal100g: kcal100g ?? null,
          p_protein100g: protein100g ?? null,
          p_carbs100g: carbs100g ?? null,
          p_fat100g: fat100g ?? null,
          p_fiber100g: fiber100g ?? null,
        }).catch((e) => console.error('save_product_for_reuse failed:', e));

        setError('');
        return true;
      } catch (err) {
        // Rollback: rimuovi item ottimistico
        setItems((current) => current.filter((item) => item.id !== tempId));
        setError(err.message || 'Errore durante l\'aggiunta del prodotto.');
        return false;
      }
    },
    [session]
  );

  const toggleItem = useCallback(
    async (id) => {
      const item = items.find((entry) => entry.id === id);
      if (!item || !supabase || !selectedListId) return;

      // Optimistic update
      const previousBought = item.bought;
      setItems((current) =>
        current.map((entry) => (entry.id === id ? { ...entry, bought: !entry.bought } : entry))
      );

      try {
        const { error: updateError } = await supabase
          .from(TABLES.SHOPPING_ITEMS)
          .update({ [COLUMNS.SHOPPING_ITEMS.BOUGHT]: !item.bought })
          .eq(COLUMNS.SHOPPING_ITEMS.ID, id);

        if (updateError) throw updateError;
      } catch (err) {
        // Rollback
        setItems((current) =>
          current.map((entry) => (entry.id === id ? { ...entry, bought: previousBought } : entry))
        );
        setError(err.message || 'Errore durante l\'aggiornamento.');
      }
    },
    [selectedListId]
  );

  const removeItem = useCallback(
    async (id) => {
      if (!supabase || !selectedListId) return;

      // Optimistic update - salva item per rollback
      const itemToRemove = items.find((entry) => entry.id === id);
      setItems((current) => current.filter((item) => item.id !== id));

      try {
        const { error: deleteError } = await supabase
          .from(TABLES.SHOPPING_ITEMS)
          .delete()
          .eq(COLUMNS.SHOPPING_ITEMS.ID, id);

        if (deleteError) throw deleteError;
      } catch (err) {
        // Rollback - reinserisci item
        if (itemToRemove) {
          setItems((current) => [itemToRemove, ...current]);
        }
        setError(err.message || 'Errore durante l\'eliminazione.');
      }
    },
    [selectedListId]
  );

  const updateItem = useCallback(
    async (id, updates) => {
      if (!supabase || !selectedListId) return false;

      // Optimistic update
      const previousItem = items.find((entry) => entry.id === id);
      if (!previousItem) return false;

      setItems((current) =>
        current.map((entry) => (entry.id === id ? { ...entry, ...updates } : entry))
      );

      try {
        const { error: updateError } = await supabase
          .from(TABLES.SHOPPING_ITEMS)
          .update(updates)
          .eq(COLUMNS.SHOPPING_ITEMS.ID, id);

        if (updateError) throw updateError;
        setError('');
        return true;
      } catch (err) {
        // Rollback
        if (previousItem) {
          setItems((current) =>
            current.map((entry) => (entry.id === id ? previousItem : entry))
          );
        }
        setError(err.message || 'Errore durante la modifica.');
        return false;
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

      // Optimistic update
      const tempId = generateTempId();
      const optimisticList = {
        id: tempId,
        name: trimmedName,
        description: 'Lista personale',
        ownerId: session.user.id,
        createdAt: new Date().toISOString(),
        itemCount: 0,
        _optimistic: true,
      };

      setLists((current) => [optimisticList, ...current]);

      try {
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

        if (insertError) throw insertError;

        const normalized = { ...normalizeLists([createdList])[0], itemCount: 0 };
        
        // Sostituisci lista ottimistica con quella reale
        setLists((current) =>
          current.map((list) => (list.id === tempId ? { ...normalized, _optimistic: false } : list))
        );
        
        setSelectedListId(normalized.id);
        setItems([]);
        return normalized;
      } catch (err) {
        // Rollback
        setLists((current) => current.filter((list) => list.id !== tempId));
        setError(err.message || 'Impossibile creare la nuova lista.');
        return null;
      }
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

      // Optimistic update - salva lista per rollback
      const listToRemove = lists.find((l) => l.id === listId);
      setLists((current) => current.filter((l) => l.id !== listId));

      try {
        const { error: deleteError } = await supabase
          .from(TABLES.SHOPPING_LISTS)
          .delete()
          .eq(COLUMNS.SHOPPING_LISTS.ID, listId);

        if (deleteError) throw deleteError;

        if (selectedListId === listId) {
          setSelectedListId(null);
          setItems([]);
        }
        return true;
      } catch (err) {
        // Rollback
        if (listToRemove) {
          setLists((current) => [listToRemove, ...current]);
        }
        setError(err.message || 'Impossibile eliminare la lista.');
        return false;
      }
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
    updateItem,
    createList,
    switchList,
    deleteList,
  };
}
