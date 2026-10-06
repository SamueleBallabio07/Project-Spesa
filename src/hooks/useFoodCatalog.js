import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DOMAIN_OPTIONS } from '../lib/schema';

const CATALOG_URL = '/catalog.json';

const DOMAIN_ORDER = DOMAIN_OPTIONS.map((d) => d.id);

const normalize = (row) => ({
  fdcId: row.id,
  name: row.name,
  shortName: row.sn,
  // in italiano appena curato, altrimenti il nome USDA
  displayName: row.sn || row.name,
  // 'food' o 'house'. Serve a raggruppare la ricerca, non a decidere se
  // mostrare le calorie: quello lo dice la presenza della nutrizione.
  domain: row.dom === 'house' ? 'house' : 'food',
  category: row.cat,
  unitDefault: row.unit,
  gramsPerUnit: row.gpu,
  kcal100g: row.kcal,
  protein100g: row.p,
  carbs100g: row.c,
  fat100g: row.f,
  fiber100g: row.fib,
  sizeLabel: row.size || '',
});

// Tollie accenti e maiuscole: "Parmigiano" deve trovare "parmigiano".
const normalizeText = (value) =>
  String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/**
 * Catalogo alimentare USDA, caricato come file statico.
 * Non usa il database: nessuna chiave API, nessuna query, funziona offline.
 * Il caricamento avviene su richiesta, non al login.
 */
export function useFoodCatalog() {
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const started = useRef(false);

  const ensureLoaded = useCallback(async () => {
    if (started.current) return;
    started.current = true;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(CATALOG_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const rows = await response.json();
      setFoods(rows.map(normalize));
    } catch (err) {
      started.current = false; // permette di riprovare
      setError('Catalogo non disponibile. Controlla la connessione e ricarica.');
      console.error('Catalogo:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // I due domini, nell'ordine in cui li mostra il selettore: prima il cibo,
  // poi la casa. Ogni dominio ha le sue categorie, cosi' i chip non
  // diventano un'unica lista piatta di 21 voci illeggibile.
  const domains = useMemo(() => {
    const present = new Set(foods.map((f) => f.domain));
    return DOMAIN_ORDER.filter((d) => present.has(d));
  }, [foods]);

  // Tutte le categorie, piatte: le usa il form di aggiunta manuale, dove la
  // voce puo' essere di qualsiasi tipo e non c'e' un dominio scelto.
  const categories = useMemo(() => {
    const unique = [...new Set(foods.map((f) => f.category))];
    return unique.sort((a, b) => a.localeCompare(b, 'en'));
  }, [foods]);

  // Categorie per dominio. Serve a mostrare solo le chip del dominio scelto:
  // senza, sotto "Casa" comparirebbero anche Verdura e Latte e latticini.
  const categoriesByDomain = useMemo(() => {
    const byDomain = new Map(DOMAIN_ORDER.map((d) => [d, new Set()]));
    for (const food of foods) {
      byDomain.get(food.domain)?.add(food.category);
    }
    return Object.fromEntries(
      [...byDomain].map(([domain, set]) => [
        domain,
        [...set].sort((a, b) => a.localeCompare(b, 'en')),
      ])
    );
  }, [foods]);

  // Indice pre-normalizzato, costruito una volta: cercare fra 7.500 righe
  // a ogni keystroke sarebbe costoso.
  const index = useMemo(
    () =>
      foods.map((food) => ({
        food,
        haystack: normalizeText(food.name),
      })),
    [foods]
  );

  const search = useCallback(
    (query, category, domain) => {
      const q = normalizeText(query.trim());

      const matches = [];
      for (const { food, haystack } of index) {
        if (domain && food.domain !== domain) continue;
        if (category && food.category !== category) continue;
        if (q && !haystack.includes(q)) continue;
        matches.push(food);
      }
      return matches;
    },
    [index]
  );

  // Libera il catalogo quando si smonta (logout, cambio vista lunga).
  useEffect(() => {
    return () => {
      started.current = false;
    };
  }, []);

  return {
    foods,
    domains,
    categories,
    categoriesByDomain,
    loading,
    error,
    search,
    ensureLoaded,
  };
}