/**
 * Test di unita' di misura, conversioni e descrizioni USDA.
 *
 * Conversioni e traduzioni sono logica pura: qui si verificano davvero. Il
 * menu di UnitPicker resta senza copertura automatica, non esserci una
 * libreria di rendering React nel progetto.
 */

import { describe, expect, it } from 'vitest';
import {
  convertQuantity,
  sizeLabelInItalian,
  stepForUnit,
  unitsFor,
} from '../src/lib/units';

describe('unitsFor', () => {
  it('a un peso offre grammi e chilogrammi', () => {
    expect(unitsFor({ unitDefault: 'g' })).toEqual(['g', 'kg']);
    expect(unitsFor({ unitDefault: 'kg' })).toEqual(['kg', 'g']);
  });

  it('a un liquido offre millilitri e litri', () => {
    expect(unitsFor({ unitDefault: 'ml' })).toEqual(['ml', 'l']);
    expect(unitsFor({ unitDefault: 'l' })).toEqual(['l', 'ml']);
  });

  it('a un countable non offre alternative', () => {
    // "uova in kg" non e' una spesa che si fa.
    expect(unitsFor({ unitDefault: 'pezzi' })).toEqual(['pezzi']);
  });

  it('non lascia mai un prodotto senza unita\'', () => {
    expect(unitsFor({})).toHaveLength(1);
    expect(unitsFor({ unitDefault: '' })).toHaveLength(1);
    expect(unitsFor(undefined)).toHaveLength(1);
  });

  it("l'unita' predefinita resta fra le offerte", () => {
    for (const unit of ['g', 'kg', 'ml', 'l', 'pezzi']) {
      expect(unitsFor({ unitDefault: unit })).toContain(unit);
    }
  });
});

describe('convertQuantity', () => {
  it('converte da grammi a chilogrammi', () => {
    expect(convertQuantity(100, 'g', 'kg')).toBe(0.1);
    expect(convertQuantity(500, 'g', 'kg')).toBe(0.5);
    expect(convertQuantity(1500, 'g', 'kg')).toBe(1.5);
  });

  it('converte da chilogrammi a grammi', () => {
    expect(convertQuantity(1.5, 'kg', 'g')).toBe(1500);
    expect(convertQuantity(0.1, 'kg', 'g')).toBe(100);
  });

  it('converte da millilitri a litri', () => {
    expect(convertQuantity(250, 'ml', 'l')).toBe(0.25);
    expect(convertQuantity(1.5, 'l', 'ml')).toBe(1500);
  });

  it('non perde i grammi andando e tornando', () => {
    for (const grams of [100, 250, 500, 1000, 1250]) {
      const kg = convertQuantity(grams, 'g', 'kg');
      expect(convertQuantity(kg, 'kg', 'g')).toBe(grams);
    }
  });

  it('stessa unita\' resta invariata', () => {
    expect(convertQuantity(300, 'g', 'g')).toBe(300);
  });

  it('rifiuta le conversioni impossibili', () => {
    // pezzi non sono convertibili in grammi senza sapere quanto pesa
    // ciascuno.
    expect(convertQuantity(2, 'pezzi', 'kg')).toBeNull();
    expect(convertQuantity(100, 'g', 'pezzi')).toBeNull();
    expect(convertQuantity(100, 'g', 'buste')).toBeNull();
  });

  it('rifiuta una quantita\' che non e\' un numero', () => {
    expect(convertQuantity('ciao', 'g', 'kg')).toBeNull();
    expect(convertQuantity(undefined, 'g', 'kg')).toBeNull();
    // Number(null) e 0: senza il controllo esplicito passerebbe come zero.
    expect(convertQuantity(null, 'g', 'kg')).toBeNull();
    expect(convertQuantity('', 'g', 'kg')).toBeNull();
    expect(convertQuantity('   ', 'g', 'kg')).toBeNull();
  });
});

describe('stepForUnit', () => {
  it('usa un passo sensato per ogni unita\'', () => {
    expect(stepForUnit('g')).toBe(10);
    expect(stepForUnit('ml')).toBe(10);
    expect(stepForUnit('pezzi')).toBe(1);
    expect(stepForUnit('kg')).toBe(0.1);
    expect(stepForUnit('l')).toBe(0.1);
  });
});

describe('sizeLabelInItalian', () => {
  it('traduce le etichette brevi', () => {
    expect(sizeLabelInItalian('medium')).toBe('medio');
    expect(sizeLabelInItalian('large')).toBe('grande');
    expect(sizeLabelInItalian('piece')).toBe('pezzo');
    expect(sizeLabelInItalian('slice')).toBe('fetta');
    expect(sizeLabelInItalian('serving')).toBe('porzione');
    expect(sizeLabelInItalian('can')).toBe('latta');
  });

  it('non si cura di maiuscole e spazi', () => {
    expect(sizeLabelInItalian('  Medium ')).toBe('medio');
    expect(sizeLabelInItalian('LARGE')).toBe('grande');
  });

  it('nasconde le descrizioni lunghe in inglese', () => {
    // Esempi reali del catalogo: utili in America, rumore nella spesa.
    expect(sizeLabelInItalian('cubic inch')).toBe('');
    expect(sizeLabelInItalian('Italian tomato')).toBe('');
    expect(sizeLabelInItalian('chop, excluding refuse (yield from 1 raw chop)')).toBe('');
    expect(sizeLabelInItalian('large (2-1/4 per pound, approx 3-3/4" long, 3", dia.)')).toBe('');
  });

  it('nasconde anche una voce breve non tradotta', () => {
    // Niente inglese a schermo, anche se la stringa e' corta.
    expect(sizeLabelInItalian('nlea serving')).toBe('');
  });

  it('gestisce l\'assenza di una dimensione', () => {
    expect(sizeLabelInItalian('')).toBe('');
    expect(sizeLabelInItalian(null)).toBe('');
    expect(sizeLabelInItalian(undefined)).toBe('');
  });
});