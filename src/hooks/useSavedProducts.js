import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { TABLES, COLUMNS } from '../lib/schema';

export function useSavedProducts(session) {
  const [savedProducts, setSavedProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchSavedProducts = useCallback(async () => {
    if (!supabase || !session) {
      setSavedProducts([]);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from(TABLES.SAVED_PRODUCTS)
      .select('*')
      .eq(COLUMNS.SAVED_PRODUCTS.USER_ID, session.user.id)
      .order(COLUMNS.SAVED_PRODUCTS.CREATED_AT, { ascending: false });

    if (!error && data) {
      setSavedProducts(
        data.map((p) => ({
          id: p[COLUMNS.SAVED_PRODUCTS.ID],
          name: p[COLUMNS.SAVED_PRODUCTS.NAME],
          quantity: Number(p[COLUMNS.SAVED_PRODUCTS.QUANTITY]),
          unit: p[COLUMNS.SAVED_PRODUCTS.UNIT],
          category: p[COLUMNS.SAVED_PRODUCTS.CATEGORY],
          notes: p[COLUMNS.SAVED_PRODUCTS.NOTES],
          kcal100g: p[COLUMNS.SAVED_PRODUCTS.KCAL100G] ?? null,
          protein100g: p[COLUMNS.SAVED_PRODUCTS.PROTEIN100G] ?? null,
          carbs100g: p[COLUMNS.SAVED_PRODUCTS.CARBS100G] ?? null,
          fat100g: p[COLUMNS.SAVED_PRODUCTS.FAT100G] ?? null,
          fiber100g: p[COLUMNS.SAVED_PRODUCTS.FIBER100G] ?? null,
        }))
      );
    }
    setLoading(false);
  }, [session]);

  useEffect(() => {
    // Il setState e' sincrono solo nel ramo senza sessione, dove serve a
    // svuotare i prodotti dell'utente precedente: arriva da un sistema esterno
    // (l'auth di Supabase) e senza azzerare, il nuovo utente vedrebbe per un
    // istante quelli dell'altro. Con la sessione presente i setState vengono
    // dopo un await e non provocano render a cascata.
    // oxlint-disable-next-line react/set-state-in-effect
    fetchSavedProducts();
  }, [fetchSavedProducts]);

  const saveProduct = useCallback(
    async ({ name, quantity, unit, category, notes, kcal100g, protein100g, carbs100g, fat100g, fiber100g }) => {
      if (!supabase || !session) return false;

      const { error } = await supabase.from(TABLES.SAVED_PRODUCTS).insert([
        {
          [COLUMNS.SAVED_PRODUCTS.USER_ID]: session.user.id,
          [COLUMNS.SAVED_PRODUCTS.NAME]: name.trim(),
          [COLUMNS.SAVED_PRODUCTS.QUANTITY]: Number(quantity) || 1,
          [COLUMNS.SAVED_PRODUCTS.UNIT]: unit,
          [COLUMNS.SAVED_PRODUCTS.CATEGORY]: category || null,
          [COLUMNS.SAVED_PRODUCTS.NOTES]: notes || null,
          [COLUMNS.SAVED_PRODUCTS.KCAL100G]: kcal100g ?? null,
          [COLUMNS.SAVED_PRODUCTS.PROTEIN100G]: protein100g ?? null,
          [COLUMNS.SAVED_PRODUCTS.CARBS100G]: carbs100g ?? null,
          [COLUMNS.SAVED_PRODUCTS.FAT100G]: fat100g ?? null,
          [COLUMNS.SAVED_PRODUCTS.FIBER100G]: fiber100g ?? null,
        },
      ]);

      if (!error) {
        await fetchSavedProducts();
        return true;
      }
      return false;
    },
    [session, fetchSavedProducts]
  );

  const deleteSavedProduct = useCallback(
    async (id) => {
      if (!supabase) return;

      const { error } = await supabase
        .from(TABLES.SAVED_PRODUCTS)
        .delete()
        .eq(COLUMNS.SAVED_PRODUCTS.ID, id);

      if (!error) {
        setSavedProducts((current) => current.filter((p) => p.id !== id));
      }
    },
    []
  );

  return {
    savedProducts,
    loading,
    saveProduct,
    deleteSavedProduct,
    refresh: fetchSavedProducts,
  };
}
