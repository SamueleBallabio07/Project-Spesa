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

      // 1. PRIMA controlla se esiste già nella STESSA lista → aumenta quantità
      const { data: sameListItems } = await supabase
        .from(TABLES.SHOPPING_ITEMS)
        .select('*')
        .eq(COLUMNS.SHOPPING_ITEMS.LIST_ID, listId);

      const sameListItem = sameListItems?.find(
        (item) => item[COLUMNS.SHOPPING_ITEMS.NAME].toLowerCase() === normalizedName
      );

      if (sameListItem) {
        const newQuantity = Number(sameListItem[COLUMNS.SHOPPING_ITEMS.QUANTITY]) + (Number(quantity) || 1);

        const { error: updateError } = await supabase
          .from(TABLES.SHOPPING_ITEMS)
          .update({ [COLUMNS.SHOPPING_ITEMS.QUANTITY]: newQuantity })
          .eq(COLUMNS.SHOPPING_ITEMS.ID, sameListItem[COLUMNS.SHOPPING_ITEMS.ID]);

        if (updateError) {
          setError(updateError.message || "Errore durante l'aggiornamento del prodotto.");
          return false;
        }

        setError('');
        await refreshItems(listId);
        return true;
      }

      // 2. POI cerca se esiste in ALTRI liste dell'utente → duplica copiando valori nutrizionali
      const { data: allUserLists } = await supabase
        .from(TABLES.SHOPPING_LISTS)
        .select(COLUMNS.SHOPPING_LISTS.ID)
        .eq(COLUMNS.SHOPPING_LISTS.OWNER_ID, userId);

      const userListIds = (allUserLists || []).map((l) => l[COLUMNS.SHOPPING_LISTS.ID]);

      let existingProduct = null;
      if (userListIds.length > 0) {
        const { data: existingItems } = await supabase
          .from(TABLES.SHOPPING_ITEMS)
          .select('*')
          .in(COLUMNS.SHOPPING_ITEMS.LIST_ID, userListIds);

        // Esclude la lista corrente (già controllata sopra)
        const otherListItems = existingItems?.filter(
          (item) => item[COLUMNS.SHOPPING_ITEMS.LIST_ID] !== listId
        ) || [];

        existingProduct = otherListItems.find(
          (item) => item[COLUMNS.SHOPPING_ITEMS.NAME].toLowerCase() === normalizedName
        ) || null;
      }

      // Se esiste già un prodotto con lo stesso nome in un'altra lista, duplica quel prodotto nella lista corrente
      // Usa la quantità inserita nel form, ma copia i valori nutrizionali dal prodotto esistente
      if (existingProduct) {
        const { error: insertError } = await supabase.from(TABLES.SHOPPING_ITEMS).insert([{
          [COLUMNS.SHOPPING_ITEMS.LIST_ID]: listId,
          [COLUMNS.SHOPPING_ITEMS.NAME]: existingProduct[COLUMNS.SHOPPING_ITEMS.NAME],
          [COLUMNS.SHOPPING_ITEMS.QUANTITY]: Number(quantity) || 1,
          [COLUMNS.SHOPPING_ITEMS.UNIT]: existingProduct[COLUMNS.SHOPPING_ITEMS.UNIT],
          [COLUMNS.SHOPPING_ITEMS.BOUGHT]: false,
          [COLUMNS.SHOPPING_ITEMS.CATEGORY]: existingProduct[COLUMNS.SHOPPING_ITEMS.CATEGORY],
          [COLUMNS.SHOPPING_ITEMS.NOTES]: existingProduct[COLUMNS.SHOPPING_ITEMS.NOTES],
          [COLUMNS.SHOPPING_ITEMS.KCAL100G]: existingProduct[COLUMNS.SHOPPING_ITEMS.KCAL100G] ?? null,
          [COLUMNS.SHOPPING_ITEMS.PROTEIN100G]: existingProduct[COLUMNS.SHOPPING_ITEMS.PROTEIN100G] ?? null,
          [COLUMNS.SHOPPING_ITEMS.CARBS100G]: existingProduct[COLUMNS.SHOPPING_ITEMS.CARBS100G] ?? null,
          [COLUMNS.SHOPPING_ITEMS.FAT100G]: existingProduct[COLUMNS.SHOPPING_ITEMS.FAT100G] ?? null,
          [COLUMNS.SHOPPING_ITEMS.FIBER100G]: existingProduct[COLUMNS.SHOPPING_ITEMS.FIBER100G] ?? null,
          [COLUMNS.SHOPPING_ITEMS.CREATED_BY]: userId,
        }]);

        if (insertError) {
          setError(insertError.message || "Errore durante l'aggiunta del prodotto.");
          return false;
        }

        setError('');
        await refreshItems(listId);
        return true;
      }

      // 3. Nuovo prodotto (non esiste in nessuna lista)
      const { error: insertError } = await supabase.from(TABLES.SHOPPING_ITEMS).insert([{
        [COLUMNS.SHOPPING_ITEMS.LIST_ID]: listId,
        [COLUMNS.SHOPPING_ITEMS.NAME]: cleanName,
        [COLUMNS.SHOPPING_ITEMS.QUANTITY]: Number(quantity) || 1,
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

      if (insertError) {
        setError(insertError.message || "Errore durante l'aggiunta del prodotto.");
        return false;
      }

      // Salva automaticamente il prodotto per uso futuro (con valori nutrizionali se presenti).
      const { error: saveError } = await supabase.from(TABLES.SAVED_PRODUCTS).upsert([{
        [COLUMNS.SAVED_PRODUCTS.USER_ID]: userId,
        [COLUMNS.SAVED_PRODUCTS.NAME]: cleanName,
        [COLUMNS.SAVED_PRODUCTS.QUANTITY]: Number(quantity) || 1,
        [COLUMNS.SAVED_PRODUCTS.UNIT]: unit,
        [COLUMNS.SAVED_PRODUCTS.CATEGORY]: category || null,
        [COLUMNS.SAVED_PRODUCTS.NOTES]: notes || null,
        [COLUMNS.SAVED_PRODUCTS.KCAL100G]: kcal100g ?? null,
        [COLUMNS.SAVED_PRODUCTS.PROTEIN100G]: protein100g ?? null,
        [COLUMNS.SAVED_PRODUCTS.CARBS100G]: carbs100g ?? null,
        [COLUMNS.SAVED_PRODUCTS.FAT100G]: fat100g ?? null,
        [COLUMNS.SAVED_PRODUCTS.FIBER100G]: fiber100g ?? null,
      }], { onConstraint: `${COLUMNS.SAVED_PRODUCTS.USER_ID},${COLUMNS.SAVED_PRODUCTS.NAME}` });

      if (saveError) {
        console.error('Salvataggio prodotto per uso futuro fallito:', saveError);
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

  const updateItem = useCallback(
    async (id, updates) => {
      if (!supabase || !selectedListId) return false;

      const { error: updateError } = await supabase
        .from(TABLES.SHOPPING_ITEMS)
        .update(updates)
        .eq(COLUMNS.SHOPPING_ITEMS.ID, id);

      if (updateError) {
        setError(updateError.message || 'Errore durante la modifica.');
        return false;
      }

      setError('');
      await refreshItems(selectedListId);
      return true;
    },
    [selectedListId, refreshItems]
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
    updateItem,
    createList,
    switchList,
    deleteList,
  };
}
