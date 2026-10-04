/**
 * Validazione del testo digitato per la quantità.
 *
 * Il campo di modifica accetta solo un numero decimale. Un testo non valido
 * non viene scritto: così nel database non finiscono mai valori a metà
 * digitazione, `NaN` o zero.
 */

/** Sotto questo valore non c'è una quantità sensata da comprare. */
export const MIN_QUANTITY = 0.1;

/** 0.1 kg ha senso, 0.001 no: due decimali bastano e tengono la colonna pulita. */
const DECIMALS = 2;

/**
 * Solo cifre con un unico separatore decimale.
 * Rifiuta segni, lettere e notazione scientifica.
 */
const DECIMAL_ONLY = /^\d*\.?\d*$/;

export function roundQuantity(value) {
  const factor = 10 ** DECIMALS;
  return Math.round(value * factor) / factor;
}

/**
 * Converte il testo digitato in quantità, o `null` se non è utilizzabile.
 *
 * Accetta la virgola come separatore decimale: è quello che produce la
 * tastiera italiana, e rifiutarla significherebbe far scrivere "0.25" a chi
 * sta scrivendo "0,25".
 *
 * @param {string} text
 * @returns {number|null}
 */
export function parseQuantityInput(text) {
  if (typeof text !== 'string') return null;

  const normalized = text.trim().replace(/,/g, '.');
  if (normalized === '' || !DECIMAL_ONLY.test(normalized)) return null;

  const value = Number(normalized);
  // Number('.') è NaN: il caso passa il pattern ma non è un numero.
  if (!Number.isFinite(value) || value < MIN_QUANTITY) return null;

  return roundQuantity(value);
}