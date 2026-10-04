/**
 * Test di unita' di misura, conversioni e descrizioni USDA.
 *
 * Conversioni e traduzioni sono logica pura: qui si verificano davvero. Il
 * menu di UnitPicker resta senza copertura automatica, non esserci una
 * libreria di rendering React nel progetto.
 */

import { describe, expect, it } from 'vitest';
import {
  ALL_UNITS,
  convertQuantity,
  sizeLabelInItalian,
  stepForUnit,
} from '../src/lib/units';

describe('ALL_UNITS', () => {
  it('offre g, kg, ml, l e pezzi', () => {
    expect(ALL_UNITS).toEqual(['g', 'kg', 'ml', 'l', 'pezzi']);
  });

  it('non contiene unita\' inesistenti', () => {
    // "buste" e "scatole" esistono in schema.js per l'inserimento manuale, ma
    // non sono unita' del catalogo.
    for (const unit of ALL_UNITS) {
      expect(['buste', 'scatole']).not.toContain(unit);
    }
  });

  it('non ha duplicati', () => {
    expect(new Set(ALL_UNITS).size).toBe(ALL_UNITS.length);
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

  it('converte pezzi in grammi quando si sa quanto pesa ciascuno', () => {
    // 6 uova da 44 g sono 264 g.
    expect(convertQuantity(6, 'pezzi', 'g', 44)).toBe(264);
    expect(convertQuantity(6, 'pezzi', 'kg', 44)).toBe(0.26);
  });

  it('converte i grammi in pezzi con lo stesso dato', () => {
    expect(convertQuantity(264, 'g', 'pezzi', 44)).toBe(6);
    expect(convertQuantity(132, 'g', 'pezzi', 44)).toBe(3);
  });

  it('incrocia pesi e volumi con la densita\' all\'acqua', () => {
    // La stessa approssimazione che regge la nutrizione: 500 ml ~ 500 g.
    expect(convertQuantity(500, 'ml', 'g')).toBe(500);
    expect(convertQuantity(2, 'l', 'g')).toBe(2000);
    expect(convertQuantity(1, 'kg', 'ml')).toBe(1000);
  });

  it('rifiuta la conversione in pezzi senza il peso del singolo pezzo', () => {
    expect(convertQuantity(2, 'pezzi', 'kg')).toBeNull();
    expect(convertQuantity(100, 'g', 'pezzi')).toBeNull();
    expect(convertQuantity(100, 'g', 'pezzi', 0)).toBeNull();
  });

  it('rifiuta unita\' inesistenti', () => {
    expect(convertQuantity(100, 'g', 'buste')).toBeNull();
    expect(convertQuantity(100, 'buste', 'g')).toBeNull();
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