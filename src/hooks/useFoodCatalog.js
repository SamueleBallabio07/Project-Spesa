import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { TABLES, COLUMNS } from '../lib/schema';

const C = COLUMNS.FOOD_CATALOG;

// I valori del catalogo sono gia' per 100g (convenzione USDA).
const normalize = (row) => {
  const name = row[C.NAME] || '';
  const labelIt = row[C.LABEL_IT] || '';

  return {
    fdcId: row[C.FDC_ID],
    name,
    shortName: row[C.SHORT_NAME] || name,
    // in italiano appena curato, altrimenti il nome USDA
    displayName: labelIt || name,
    labelIt,
    category: row[C.USDA_CATEGORY] || 'Altro',
    unitDefault: row[C.UNIT_DEFAULT] || 'g',
    gramsPerUnit: row[C.GRAMS_PER_UNIT] === null ? null : Number(row[C.GRAMS_PER_UNIT]),
    kcal100g: Number(row[C.KCAL_100G]) || 0,
    protein100g: Number(row[C.PROTEIN_100G]) || 0,
    carbs100g: Number(row[C.CARBS_100G]) || 0,
    fat100g: Number(row[C.FAT_100G]) || 0,
    fiber100g: Number(row[C.FIBER_100G]) || 0,
    sizeLabel: row[C.SIZE_LABEL] || '',
    verified: Boolean(row[C.VERIFIED]),
  };
};

// Tollie accenti e maiuscole: "Parmigiano" deve trovare "parmigiano".
const normalizeText = (value) =>
  String(value)
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
        'Catalogo non disponibile. Crea la tabella con database/food_catalog.sql e importala con database/food_catalog_usda.sql.'
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
    return unique.sort((a, b) => a.localeCompare(b, 'en'));
  }, [foods]);

  // Indice pre-normalizzato, costruito una volta sola: la ricerca
  // su 7.800 righe a ogni keystroke costerebbe troppo.
  const index = useMemo(
    () =>
      foods.map((food) => ({
        food,
        haystack: normalizeText([food.name, food.shortName, food.labelIt].join(' ')),
      })),
    [foods]
  );

  const search = useCallback(
    (query, category) => {
      const q = normalizeText(query.trim());

      const matches = [];
      for (const { food, haystack } of index) {
        if (category && food.category !== category) continue;
        if (q && !haystack.includes(q)) continue;
        matches.push(food);
      }
      return matches;
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