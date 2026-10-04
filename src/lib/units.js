/**
 * Unita' di misura del catalogo: quali offrire, come convertirle, con che
 * passo, e come tradurre le descrizioni USDA.
 *
 * Ogni prodotto puo' essere misurato in qualsiasi modo. Il catalogo usa solo
 * tre unita' come predefinita (`g`, `ml`, `pezzi`), ma "un litro" e "una
 * bottiglia" sono la stessa spesa detta in due modi, e in cucina si passa da
 * una all'altra senza pensarci.
 */

import { roundQuantity } from './quantity';
import { GRAMS_PER_UNIT } from './nutrition';

/**
 * Tutte le unita' che il selettore offre, sempre nello stesso ordine.
 *
 * Un ordine fisso perche' il menu sia identico ovunque: se cambiasse a ogni
 * prodotto, con 5 voci in uso non sapresti dove guardare. Quella attiva e'
 * comunque evidenziata.
 */
export const ALL_UNITS = ['g', 'kg', 'ml', 'l', 'pezzi'];

/** Etichette brevi USDA -> italiano. */
const SIZE_LABELS = {
  medium: 'medio',
  large: 'grande',
  piece: 'pezzo',
  serving: 'porzione',
  can: 'latta',
  fillet: 'filetto',
  slice: 'fetta',
  'slice raw': 'fetta cruda',
  'slice, large': 'fetta grande',
  leaf: 'foglia',
  head: 'testa',
  bunch: 'mazzetto',
  breadstick: 'grissino',
  lobster: 'aragosta',
  pepper: 'peperone',
  grape: 'acino',
};

const SIZE_MAX_LENGTH = 20;

/**
 * Passo dello stepper per unita'.
 *
 * 10 per i pesi e i volumi in scala piccola, 0.1 per kg e litri, 1 per i
 * pezzi. Con 1 su tutto, 0.1 kg si raggiungeva solo digitandolo a mano.
 */
export function stepForUnit(unit) {
  if (unit === 'pezzi') return 1;
  if (unit === 'kg' || unit === 'l') return 0.1;
  return 10;
}

/** Grammi corrispondenti a una quantita' nell'unita' data. */
function toGrams(quantity, unit, gramsPerUnit) {
  if (unit === 'pezzi') {
    const perPiece = Number(gramsPerUnit);
    // Senza il peso del singolo pezzo non c'e' modo di sapere quanto pesano.
    return Number.isFinite(perPiece) && perPiece !== 0 ? quantity * perPiece : null;
  }

  const factor = GRAMS_PER_UNIT[unit];
  return factor ? quantity * factor : null;
}

/**
 * Converte una quantita' da un'unita' a un'altra passando dai grammi.
 *
 * Il passaggio e' sempre in due tempi cosi' pezzi, pesi e volumi si
 * incrociano senza farsi casi speciali a coppie. I fattori sono quelli della
 * nutrizione: ml e kg valgono come i grammi, come fa la cucina.
 *
 * @returns {number|null} null se la conversione non e' possibile
 */
export function convertQuantity(quantity, from, to, gramsPerUnit) {
  // Number(null) e Number('') valgono 0: senza questo controllo una quantita'
  // assente passerebbe come zero e finirebbe nel database.
  if (quantity === null || quantity === undefined) return null;
  if (typeof quantity === 'string' && quantity.trim() === '') return null;

  const value = Number(quantity);
  if (!Number.isFinite(value)) return null;
  if (from === to) return roundQuantity(value);

  const grams = toGrams(value, from, gramsPerUnit);
  if (grams === null) return null;

  // Un grammo in unita' "to": pezzi se si conosce il peso di ciascuno,
  // altrimenti il fattore dell'unita'.
  const target = toGrams(1, to, gramsPerUnit);
  if (!target) return null;

  const converted = grams / target;
  if (!Number.isFinite(converted)) return null;

  return roundQuantity(converted);
}

/**
 * Descrizione USDA in italiano, solo se breve.
 *
 * Il catalogo contiene roba come "large (2-1/4 per pound, approx 3-3/4" long,
 * 3", dia.)": utile in America, solo rumore nella lista della spesa. Una
 * descrizione lunga o non tradotta non viene mostrata.
 */
export function sizeLabelInItalian(size) {
  const key = String(size ?? '').trim().toLowerCase();
  if (!key) return '';

  // Difesa anche per future voci corte non ancora nel dizionario: niente
  // inglese a schermo.
  if (key.length > SIZE_MAX_LENGTH) return '';

  return SIZE_LABELS[key] ?? '';
}