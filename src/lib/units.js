/**
 * Unita' di misura del catalogo: quali offrire, come convertirle, con che
 * passo, e come tradurre le descrizioni USDA.
 *
 * Il catalogo usa solo tre unita' (`pezzi`, `g`, `ml`), quindi offrire tutte e
 * cinque a ogni prodotto lasciava scegliere cose senza senso: litri di
 * parmigiano, chili di caffe'.
 */

import { roundQuantity } from './quantity';

/** Fattori verso l'unita' base di ogni gruppo. */
const GRAMS = { g: 1, kg: 1000, ml: 1, l: 1000 };

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

/**
 * Le unita' sensate per un alimento.
 *
 * Un peso si compra in g o kg, un liquido in ml o l, un countable solo in
 * pezzi: "uova in kg" non e' una spesa che si fa.
 *
 * @returns {string[]} almeno una unita', l'unita' predefinita per ultima
 */
export function unitsFor(food) {
  const unit = food?.unitDefault;

  if (unit === 'g' || unit === 'kg') return unit === 'g' ? ['g', 'kg'] : ['kg', 'g'];
  if (unit === 'ml' || unit === 'l') return unit === 'ml' ? ['ml', 'l'] : ['l', 'ml'];

  // Con una sola unita' possibile il selettore non ha niente da dire.
  return unit ? [unit] : ['pezzi'];
}

/**
 * Converte una quantita' da un'unita' a un'altra dello stesso gruppo.
 *
 * `g`/`kg` e `ml`/`l` sono fattori esatti, quindi la nutrizione non cambia:
 * i valori sono per 100g e i grammi restano gli stessi.
 *
 * @returns {number|null} null se la conversione non e' possibile
 */
export function convertQuantity(quantity, from, to) {
  // Number(null) e Number('') valgono 0: senza questo controllo una quantita'
  // assente passerebbe come zero e finirebbe nel database.
  if (quantity === null || quantity === undefined) return null;
  if (typeof quantity === 'string' && quantity.trim() === '') return null;

  const value = Number(quantity);
  if (!Number.isFinite(value)) return null;
  if (from === to) return roundQuantity(value);

  const fromFactor = GRAMS[from];
  const toFactor = GRAMS[to];
  if (!fromFactor || !toFactor) return null;

  return roundQuantity((value * fromFactor) / toFactor);
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