import { describe, expect, it } from 'vitest';
import {
  formatMacros,
  formatNutrition,
  gramsFor,
  nutritionFor,
  toGrams,
} from '../src/lib/nutrition.js';

const food = (over = {}) => ({
  gramsPerUnit: null,
  kcal100g: 100,
  protein100g: 10,
  carbs100g: 20,
  fat100g: 5,
  fiber100g: 2,
  ...over,
});

describe('toGrams', () => {
  it('converte direttamente le unita di peso', () => {
    expect(toGrams(500, 'g', null)).toBe(500);
    expect(toGrams(2, 'kg', null)).toBe(2000);
  });

  it('tratta ml e l come densità approssimata all acqua', () => {
    expect(toGrams(250, 'ml', null)).toBe(250);
    expect(toGrams(1.5, 'l', null)).toBe(1500);
  });

  it('moltiplica per gramsPerUnit sulle unita di conteggio', () => {
    expect(toGrams(3, 'pezzi', 50)).toBe(150);
    expect(toGrams(2, 'buste', 250)).toBe(500);
  });

  it('restituisce null quando non e convertibile', () => {
    expect(toGrams(2, 'pezzi', null)).toBeNull();
    expect(toGrams(2, 'pezzi', undefined)).toBeNull();
  });

  it('non usa gramsPerUnit se non e un numero finito', () => {
    expect(toGrams(2, 'pezzi', NaN)).toBeNull();
    expect(toGrams(2, 'pezzi', Infinity)).toBeNull();
  });

  it('non confonde le unita di peso con gramsPerUnit', () => {
    // con gramsPerUnit presente la conversione diretta deve avere la precedenza
    expect(toGrams(1, 'kg', 50)).toBe(1000);
  });

  it('normalizza quantita non numeriche a zero', () => {
    expect(toGrams('ciao', 'g', null)).toBe(0);
    expect(toGrams(null, 'g', null)).toBe(0);
  });
});

describe('nutritionFor', () => {
  it('scala i valori per 100g sulla quantita scelta', () => {
    // 200g = 2x100g
    expect(nutritionFor(food(), 200, 'g')).toMatchObject({
      grams: 200,
      kcal: 200,
      protein: 20,
      carbs: 40,
      fat: 10,
    });
  });

  it('scala correttamente le frazioni', () => {
    // 50g = 0.5x100g
    expect(nutritionFor(food(), 50, 'g')).toMatchObject({
      kcal: 50,
      protein: 5,
      carbs: 10,
      fat: 2.5,
    });
  });

  it('restituisce null se non convertibile in grammi', () => {
    expect(nutritionFor(food(), 2, 'pezzi')).toBeNull();
  });

  it('tratta fiber mancante come zero senza NaN', () => {
    const n = nutritionFor(food({ fiber100g: null }), 200, 'g');
    expect(n.fiber).toBe(0);
  });

  it('produce 0 kcal per una quantita zero, non NaN', () => {
    const n = nutritionFor(food(), 0, 'g');
    expect(n.kcal).toBe(0);
    expect(Number.isNaN(n.kcal)).toBe(false);
  });

  // I prodotti non commestibili (detersivi, carta) non hanno valori
  // nutrizionali: il catalogo porta null al posto dei nutrienti.
  it('restituisce null se il prodotto non ha nutrizione', () => {
    const nonCommestibile = food({
      gramsPerUnit: null,
      kcal100g: null,
      protein100g: null,
      carbs100g: null,
      fat100g: null,
      fiber100g: null,
    });
    expect(nutritionFor(nonCommestibile, 2, 'pezzi')).toBeNull();
  });

  it('restituisce null anche se il prodotto ha valori ma sono null', () => {
    // kcal100g null con gramsPerUnit valorizzato: senza questo controllo
    // tornerebbe 0 kcal, cioe' "questo detersivo contiene zero calorie".
    const strano = food({ gramsPerUnit: 1500, kcal100g: null });
    expect(nutritionFor(strano, 2, 'pezzi')).toBeNull();
  });

  it('non confonde una nutrizione a zero con una nutrizione assente', () => {
    // Acqua e sale valgono 0 kcal e devono restare mostrate come 0.
    expect(nutritionFor(food({ kcal100g: 0 }), 200, 'g')).toMatchObject({ kcal: 0 });
  });
});

describe('formatNutrition', () => {
  it('stringa vuota quando non c e nutrizione', () => {
    expect(formatNutrition(null, 'g')).toBe('');
  });

  it('usa i grammi sotto il chilo', () => {
    expect(formatNutrition(nutritionFor(food(), 250, 'g'), 'g')).toBe('250 g · 250 kcal');
  });

  it('passa ai kilo sopra i 1000g', () => {
    expect(formatNutrition(nutritionFor(food(), 1500, 'g'), 'g')).toBe('1.5 kg · 1500 kcal');
  });

  it('usa i kilo quando l unita richiesta e kg', () => {
    expect(formatNutrition(nutritionFor(food(), 500, 'g'), 'kg')).toBe('0.5 kg · 500 kcal');
  });
});

describe('formatMacros', () => {
  it('mostra solo i macronutrienti presenti', () => {
    const n = nutritionFor(food(), 100, 'g');
    // fiber non e un macronutriente: non deve comparire
    expect(formatMacros(n)).toBe('P 10 · C 20 · G 5');
  });

  it('omette gli zeri', () => {
    const n = nutritionFor(food({ carbs100g: 0 }), 100, 'g');
    expect(formatMacros(n)).toBe('P 10 · G 5');
  });

  it('stringa vuota se non c e nessun macronutriente', () => {
    expect(formatMacros(nutritionFor(food({ protein100g: 0, carbs100g: 0, fat100g: 0 }), 100, 'g'))).toBe('');
  });

  it('stringa vuota quando non c e nutrizione', () => {
    expect(formatMacros(null)).toBe('');
  });

  it('arrotonda a una cifra', () => {
    const n = nutritionFor(food({ protein100g: 6.44 }), 100, 'g');
    expect(formatMacros(n)).toContain('P 6,4');
  });
});

describe('gramsFor', () => {
  it('usa il valore del catalogo se valido', () => {
    expect(gramsFor({ gramsPerUnit: 30 })).toBe(30);
  });

  it('altrimenti cade su 100', () => {
    expect(gramsFor({ gramsPerUnit: null })).toBe(100);
    expect(gramsFor({ gramsPerUnit: NaN })).toBe(100);
    expect(gramsFor({})).toBe(100);
  });
});
