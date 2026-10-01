import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { TABLES, COLUMNS } from '../lib/schema';

const C = COLUMNS.FOOD_CATALOG;

const normalize = (row) => ({
  id: row[C.ID],
  name: row[C.NAME],
  aliases: row[C.ALIASES] || [],
  category: row[C.CATEGORY],
  unitDefault: row[C.UNIT_DEFAULT] || 'g',
  gramsPerUnit: row[C.GRAMS_PER_UNIT] === null ? null : Number(row[C.GRAMS_PER_UNIT]),
  kcal100g: Number(row[C.KCAL_100G]) || 0,
  protein100g: Number(row[C.PROTEIN_100G]) || 0,
  carbs100g: Number(row[C.CARBS_100G]) || 0,
  fat100g: Number(row[C.FAT_100G]) || 0,
  fiber100g: Number(row[C.FIBER_100G]) || 0,
  verified: Boolean(row[C.VERIFIED]),
});

const normalizeText = (value) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export function useFoodCatalog(session) {
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCatalog = useCallback(async () => {
    if (!supabase || !session) {
      setFoods([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from(TABLES.FOOD_CATALOG)
      .select('*')
      .order(C.NAME);

    if (fetchError) {
      setError(
        'Catalogo non disponibile. Esegui database/food_catalog.sql e food_catalog_seed.sql su Supabase.'
      );
      setFoods([]);
    } else {
      setFoods((data || []).map(normalize));
    }

    setLoading(false);
  }, [session]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const categories = useMemo(() => {
    const unique = [...new Set(foods.map((f) => f.category))];
    return unique.sort((a, b) => a.localeCompare(b, 'it'));
  }, [foods]);

  // Indice di ricerca pre-normalizzato: nome + alias, senza accenti.
  const index = useMemo(
    () =>
      foods.map((food) => ({
        food,
        haystack: normalizeText([food.name, ...food.aliases].join(' ')),
      })),
    [foods]
  );

  const search = useCallback(
    (query, category) => {
      const q = normalizeText(query.trim());

      return index
        .filter(({ food, haystack }) => {
          const matchesCategory = !category || food.category === category;
          const matchesQuery = !q || haystack.includes(q);
          return matchesCategory && matchesQuery;
        })
        .map(({ food }) => food);
    },
    [index]
  );

  return {
    foods,
    categories,
    loading,
    error,
    search,
    refresh: fetchCatalog,
  };
}