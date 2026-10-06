/**
 * Costruisce public/catalog.json a partire dalla tassonomia curata.
 *
 *   npm run build:catalog
 *
 * Il catalogo ha due domini:
 *
 *   - `food`: commestibili, con valori nutrizionali per 100g presi da USDA
 *     FoodData Central (SR Legacy). Non sono stime: analisi di laboratorio o
 *     calcoli dell'USDA.
 *   - `house`: prodotti non commestibili (detersivi, carta, casalinghi).
 *     Non esistono valori nutrizionali per queste cose, quindi non passano da
 *     USDA e portano `null` al posto dei nutrienti: e' la presenza della
 *     nutrizione, non il campo `dom`, a dire all'app se mostrare le calorie.
 *
 *   1. legge data/usda.json, l'estratto completo di USDA. Non c'e' piu' uno
 *      script che lo produca dagli ZIP: rigenerarlo e' un passaggio manuale
 *   2. legge database/catalog-taxonomy.json, che e' l'artefatto curato
 *   3. risolve ogni query USDA scegliendo la voce che inizia col primo
 *      termine e non contiene parole da scartare
 *   4. applica gli override per i casi in cui la scelta automatica
 *      non e' quella giusta
 *   5. copia le voci house cosi' come sono
 *   6. scrive il JSON e un report da controllare
 *
 * Se l'USDA cambia una descrizione, la query smette di risolvere e la voce
 * viene segnalata nel report invece di fallire in silenzio.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const curated = JSON.parse(readFileSync('database/catalog-taxonomy.json', 'utf8'));
const { queries, overrides = {}, manual = {}, cats = {}, house = {} } = curated;

/**
 * Campi nutrizionali di una voce. Una voce house non ne deve avere nessuno:
 * se un giorno ne ha, non e' un prodotto non commestibile e sta nel blocco
 * sbagliato. Fallire qui e' meglio che pubblicare calorie inventate.
 */
const NUTRIENT_FIELDS = ['kcal', 'p', 'c', 'f', 'fib'];

const BAD = [
  'canned', 'juice', 'infant', 'baby', 'powder', 'dried', 'dehydrated',
  'juiced', 'with added', 'nectar', 'mix', 'salad', 'soup', 'beverage',
  'drink', 'flavor', 'fast food', 'school', 'frozen', 'cooked', 'toasted',
];

const GOOD = ['raw', 'fresh', 'plain', 'uncooked'];

const norm = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const foods = JSON.parse(readFileSync('data/usda.json', 'utf8'));

// ---------- risoluzione ----------

function candidates(query) {
  const tokens = norm(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];

  // confronto a confine di parola: "butter" non deve pescare "Butterbur"
  // ne' "butternut", ma deve poter trovare "Fish, salmon, ..."
  const patterns = tokens.map((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`));

  return foods
    .map((food) => {
      const name = norm(food.name);
      if (patterns.some((re) => !re.test(name))) return null;

      let score = 100;
      for (const b of BAD) if (name.includes(b)) score -= 40;
      for (const g of GOOD) if (name.includes(g)) score += 8;

      // Il termine principale conta di piu' se e' il soggetto della voce:
      // in "Butter, salted" butter e' il soggetto, in "Nuts, cashew butter"
      // no. Serve perche' USDA mette a volte il generico davanti
      // ("Fish, salmon, chinook"), dove il termine arriva al secondo posto.
      const segments = name.split(',').map((s) => s.trim());
      if (new RegExp(`\\b${tokens[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(segments[0])) {
        score += 30;
      } else if (segments.length > 1 && new RegExp(`\\b${tokens[0]}\\b`).test(segments[1])) {
        score += 10;
      } else {
        score -= 15;
      }

      // descrizioni piu' lunghe aggiungono dettagli, non rumore
      score -= Math.round(food.name.length / 6);

      return { food, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
}

// ---------- costruzione ----------

const rows = [];
const report = [];
const usedFdcIds = new Set();

for (const [it, query] of Object.entries(queries)) {
  const category = cats[it] || 'Altro';

  // escluso di proposito: USDA ha solo voci di marca
  if (overrides[it] === null) {
    report.push({ it, state: 'omesso', detail: 'solo voci di marca in USDA' });
    continue;
  }

  // valori non provenienti da USDA (acqua, the: noti per definizione)
  if (manual[it]) {
    const m = manual[it];
    rows.push({
      id: `m${rows.length}`,
      name: it,
      sn: it,
      dom: 'food',
      cat: category,
      unit: m.unit || 'g',
      gpu: m.gpu ?? 1,
      kcal: m.kcal,
      p: m.p || 0,
      c: m.c || 0,
      f: m.f || 0,
      fib: m.fib || 0,
      note: m.note,
    });
    report.push({ it, state: 'manuale', detail: `${m.kcal} kcal` });
    continue;
  }

  const wanted = overrides[it] ?? query;
  const hits = candidates(wanted);

  if (!hits.length) {
    report.push({ it, state: 'NON RISOLTO', detail: `"${wanted}"` });
    continue;
  }

  // Sceglie il primo candidato il cui fdcId non e' gia' stato usato
  let pick = null;
  for (const hit of hits) {
    if (!usedFdcIds.has(String(hit.food.id))) {
      pick = hit.food;
      usedFdcIds.add(String(pick.id));
      break;
    }
  }

  if (!pick) {
    report.push({ it, state: 'NON RISOLTO', detail: `tutti i candidati hanno fdcId gia' usati per "${wanted}"` });
    continue;
  }

  const countable = pick.unit === 'pezzi';

  rows.push({
    id: pick.id,
    name: it,
    sn: it,
    dom: 'food',
    cat: category,
    unit: countable ? 'pezzi' : 'g',
    gpu: countable ? pick.gpu : 1,
    kcal: pick.kcal,
    p: pick.p,
    c: pick.c,
    f: pick.f,
    fib: pick.fib,
    size: countable ? pick.size : '',
    usda: pick.name,
  });

  report.push({ it, state: 'ok', fdc: pick.id, kcal: pick.kcal, usda: pick.name });
}

// ---------- case: non commestibili ----------
//
// Nessuna risoluzione USDA e nessuna nutrizione: la voce entra cosi' com'e'.
// Un id prefissato 'h' la distingue dai numeri di fdcId e dai 'm' del blocco
// manuale, cosi' due voci non possono condividere lo stesso id.

const erroriHouse = [];

for (const [it, h] of Object.entries(house)) {
  if (!h.cat) erroriHouse.push(`${it}: manca cat`);
  if (!h.unit) erroriHouse.push(`${it}: manca unit`);

  for (const campo of NUTRIENT_FIELDS) {
    if (h[campo] !== undefined) {
      erroriHouse.push(`${it}: campo nutrizionale '${campo}' su una voce non commestibile`);
    }
  }
  if (h.gpu !== undefined) {
    erroriHouse.push(`${it}: gpu su una voce non commestibile (servirebbe solo per la nutrizione)`);
  }
  if (rows.some((r) => r.name === it)) {
    erroriHouse.push(`${it}: nome duplicato con una voce food`);
  }
}

if (erroriHouse.length) {
  console.error("Il blocco house non e' valido:\n  " + erroriHouse.join('\n  '));
  process.exit(1);
}

for (const [it, h] of Object.entries(house)) {
  rows.push({
    id: `h${rows.length}`,
    name: it,
    sn: it,
    dom: 'house',
    cat: h.cat,
    unit: h.unit,
    gpu: null,
    kcal: null,
    p: null,
    c: null,
    f: null,
    fib: null,
    size: '',
    note: h.note,
  });

  report.push({ it, state: 'house', detail: h.cat });
}

// ---------- output ----------

const json = JSON.stringify(rows);
writeFileSync('public/catalog.json', json);

const gzipBytes = gzipSync(json).length;
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

const foodRows = rows.filter((r) => r.dom === 'food').length;
const houseRows = rows.length - foodRows;

console.log(
  `public/catalog.json  ${rows.length} voci  ${kb(gzipBytes)} gzip`
  + `  (${foodRows} food, ${houseRows} casa)\n`
);

const categorie = [...new Set(rows.map((r) => r.cat))].sort();
console.log(`categorie: ${categorie.length} · ${categorie.join(', ')}\n`);

const toCheck = report.filter((r) => r.state !== 'ok' && r.state !== 'house');
if (toCheck.length) {
  console.log('--- da controllare ---');
  for (const r of toCheck) console.log(`  ${r.state.padEnd(12)} ${r.it.padEnd(24)} ${r.detail || ''}`);
  console.log('');
}

console.log('--- valori risolti ---');
for (const r of report.filter((x) => x.state === 'ok')) {
  console.log(
    `  ${String(r.fdc).padStart(6)} ${String(r.kcal).padStart(5)}  ${r.it.padEnd(24)} ${r.usda.slice(0, 54)}`
  );
}