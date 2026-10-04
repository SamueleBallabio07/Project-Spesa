/**
 * Test della validazione della quantità digitata a mano.
 *
 * È la garanzia che nel database non finiscano mai valori a metà digitazione:
 * il campo di modifica passa dal testo libero al numero, e un numero sbagliato
 * qui diventa un errore che l'utente non può più correggere da solo.
 */

import { describe, expect, it } from 'vitest';
import { MIN_QUANTITY, parseQuantityInput, roundQuantity } from '../src/lib/quantity';

describe('parseQuantityInput', () => {
  it('accetta un intero', () => {
    // Il caso d'uso: 100 g di patate da portare a 300.
    expect(parseQuantityInput('300')).toBe(300);
    expect(parseQuantityInput('100')).toBe(100);
    expect(parseQuantityInput('1')).toBe(1);
  });

  it('accetta decimali con il punto', () => {
    expect(parseQuantityInput('0.25')).toBe(0.25);
    expect(parseQuantityInput('12.75')).toBe(12.75);
  });

  it('accetta la virgola, come la produce la tastiera italiana', () => {
    expect(parseQuantityInput('0,25')).toBe(0.25);
    expect(parseQuantityInput('1,5')).toBe(1.5);
  });

  it('ignora spazi attorno al numero', () => {
    expect(parseQuantityInput('  300  ')).toBe(300);
  });

  it('rifiuta il testo vuoto', () => {
    expect(parseQuantityInput('')).toBeNull();
    expect(parseQuantityInput('   ')).toBeNull();
  });

  it('rifiuta quello che non è un numero', () => {
    expect(parseQuantityInput('abc')).toBeNull();
    expect(parseQuantityInput('3g')).toBeNull();
    expect(parseQuantityInput('1.2.3')).toBeNull();
    expect(parseQuantityInput('.')).toBeNull();
  });

  it('rifiuta i segni, così non si può scrivere un negativo', () => {
    expect(parseQuantityInput('-5')).toBeNull();
    expect(parseQuantityInput('+5')).toBeNull();
  });

  it('rifiuta la notazione scientifica', () => {
    // Passerebbe Number(), ma "1e5" è rumore in un campo da tastiera.
    expect(parseQuantityInput('1e5')).toBeNull();
  });

  it('rifiuta zero e i valori sotto il minimo', () => {
    expect(parseQuantityInput('0')).toBeNull();
    expect(parseQuantityInput('0.09')).toBeNull();
    expect(parseQuantityInput('0.05')).toBeNull();
  });

  it('accetta il minimo esatto', () => {
    expect(parseQuantityInput('0.1')).toBe(MIN_QUANTITY);
    expect(parseQuantityInput('0,1')).toBe(MIN_QUANTITY);
  });

  it('arrotonda a due decimali', () => {
    expect(parseQuantityInput('0.254')).toBe(0.25);
    expect(parseQuantityInput('0.256')).toBe(0.26);
    expect(parseQuantityInput('299.999')).toBe(300);
  });

  it('rifiuta un valore che non è una stringa', () => {
    expect(parseQuantityInput(null)).toBeNull();
    expect(parseQuantityInput(undefined)).toBeNull();
    expect(parseQuantityInput(300)).toBeNull();
  });
});

describe('roundQuantity', () => {
  it('taglia alla seconda cifra decimale', () => {
    expect(roundQuantity(1.006)).toBe(1.01);
    expect(roundQuantity(1.004)).toBe(1);
    expect(roundQuantity(0.1 + 0.2)).toBe(0.3);
  });

  it('i punti medi arrotondano secondo la rappresentazione binaria', () => {
    // 1.005 vale in memoria 1.0049999..., quindi arrotonda a 1 e non a 1.01.
    // Non è un difetto: è cosa fanno i double, e il caso è irrilevante qui
    // perché l'utente digita al massimo due decimali.
    expect(roundQuantity(1.005)).toBe(1);
  });
});