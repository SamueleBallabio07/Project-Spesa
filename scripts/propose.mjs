/**
 * Aiuto alla curatura: per ogni alimento italiano cerca i candidati USDA
 * piu' plausibili e li stampa, con i valori, cosi' da poter scegliere
 * quello giusto a occhio.
 *
 *   node scripts/propose.mjs            # tutto
 *   node scripts/propose.mjs latte uova # solo le query che contengono questi testi
 *
 * Non scrive nulla: serve solo a costruire a mano database/staples-it.json.
 */

import { readFileSync } from 'node:fs';

const rows = JSON.parse(readFileSync('public/catalog.json', 'utf8'));
const filters = process.argv.slice(2).map((s) => s.toLowerCase());

// Penalita' perche' un alimento base non dovrebbe essere lavorato.
const BAD = [
  'canned', 'juice', 'infant', 'baby', 'powder', 'dried', 'dehydrated',
  'juiced', 'with added', 'nectar', 'mix', 'salad', 'soup', 'beverage',
  'drink', 'flavor', 'flavors', 'brand', 'stuffed', 'fast food', 'school',
];

// Bonus quando la preparazione e' quella base.
const GOOD = ['raw', 'fresh', 'plain', 'uncooked'];

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function score(food, query) {
  const name = norm(food.name);
  const tokens = norm(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;

  // tutti i token devono comparire
  const missing = tokens.filter((t) => !name.includes(t));
  if (missing.length) return null;

  // il primo token deve essere l'inizio della voce ("butter" non deve
  // pescare "Butterbur" ne' "butternut"): confronta a confine di parola
  const head = name.split(',')[0].trim();
  if (!head.startsWith(tokens[0])) return null;
  if (head.length > tokens[0].length && !/[\s-]/.test(head[tokens[0].length])) return null;

  let s = 100;

  for (const b of BAD) if (name.includes(b)) s -= 40;
  for (const g of GOOD) if (name.includes(g)) s += 8;

  // preferisce la descrizione piu' corta: di solito e' la generica
  s -= Math.round(food.name.length / 6);

  return s;
}

function propose(it, q) {
  const hits = rows
    .map((food) => ({ food, s: score(food, q) }))
    .filter((h) => h.s !== null)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3);

  return { it, q, hits };
}

const QUERIES = JSON.parse(readFileSync('database/staples-queries.json', 'utf8'));

for (const [it, q] of Object.entries(QUERIES)) {
  if (filters.length && !filters.some((f) => norm(it).includes(f) || q.toLowerCase().includes(f))) continue;

  const { hits } = propose(it, q);

  if (!hits.length) {
    console.log(`\n✗ ${it.padEnd(28)} "${q}"  → NESSUN CANDIDATO`);
    continue;
  }

  console.log(`\n${it}   [${q}]`);
  for (const { food, s } of hits) {
    console.log(
      `    ${String(food.id).padStart(6)}  ${s > 0 ? '+' : ''}${s}  ${food.name.slice(0, 62)}` +
        `  |  ${food.kcal}kcal  ${food.p}P ${food.c}C ${food.f}F  [${food.unit}${food.size ? ' ' + food.size : ''}]`
    );
  }
}