// Calcolo dei valori nutrizionali a partire dal catalogo.
// Convenzione: i valori del catalogo sono sempre per 100g, quindi
// convertiamo prima la quantita' scelta in grammi.

const WEIGHT_UNITS = {
  g: 1,
  kg: 1000,
  ml: 1, // densita' approssimata all'acqua
  l: 1000,
};

const isWeightUnit = (unit) => Object.prototype.hasOwnProperty.call(WEIGHT_UNITS, unit);

/**
 * Converte (quantita', unita') in grammi.
 * - unita' di peso/volume: diretto
 * - unita' di conteggio: quantita' * grams_per_unit
 */
export function toGrams(quantity, unit, gramsPerUnit) {
  const qty = Number(quantity) || 0;

  if (isWeightUnit(unit)) return qty * WEIGHT_UNITS[unit];

  if (Number.isFinite(Number(gramsPerUnit)) && gramsPerUnit !== null) {
    return qty * Number(gramsPerUnit);
  }

  return null; // non convertibile: mostriamo solo i valori per 100g
}

/**
 * Nutrizioni per la quantita' scelta.
 * Restituisce null se non convertibile in grammi.
 */
export function nutritionFor(food, quantity, unit) {
  const grams = toGrams(quantity, unit, food.gramsPerUnit);
  if (grams === null) return null;

  const ratio = grams / 100;
  return {
    grams,
    kcal: food.kcal100g * ratio,
    protein: food.protein100g * ratio,
    carbs: food.carbs100g * ratio,
    fat: food.fat100g * ratio,
    fiber: (food.fiber100g || 0) * ratio,
  };
}

const round = (n, digits = 1) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

/** "1,4 kg · 620 kcal" — peso e calorie per la quantita' scelta. */
export function formatNutrition(nutrition, unit) {
  if (!nutrition) return '';

  const gramsLabel =
    unit === 'kg' || nutrition.grams >= 1000
      ? `${round(nutrition.grams / 1000, 2)} kg`
      : `${round(nutrition.grams, 0)} g`;

  return `${gramsLabel} · ${round(nutrition.kcal, 0)} kcal`;
}

/** Riga macronutrienti: "P 6,4 · C 3,2 · G 8,1" */
export function formatMacros(nutrition) {
  if (!nutrition) return '';
  const parts = [
    ['P', nutrition.protein],
    ['C', nutrition.carbs],
    ['G', nutrition.fat],
  ].filter(([, value]) => value > 0);

  if (!parts.length) return '';
  return parts.map(([label, value]) => `${label} ${round(value, 1).toLocaleString('it-IT')}`).join(' · ');
}

/**
 * Grammi per unita' di conteggio con fallback sensato.
 * Number(null) e' 0 e 0 e un numero finito: senza il controllo esplicito su
 * null il fallback diventerebbe "0 grammi per pezzi" invece di 100.
 */
export const gramsFor = (food) => {
  const gpu = food?.gramsPerUnit;
  if (gpu === null || gpu === undefined || gpu === '') return 100;
  const n = Number(gpu);
  return Number.isFinite(n) && n > 0 ? n : 100;
};