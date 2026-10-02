/**
 * Costruisce public/catalog.json a partire dal catalogo curato in italiano.
 *
 *   node scripts/build-catalog.mjs
 *
 * I valori nutrizionali vengono da USDA FoodData Central (SR Legacy) e non
 * sono stime: analisi di laboratorio o calcoli dell'USDA.
 *
 *   1. legge data/usda.json, l'estratto completo di USDA
 *      (rigenerabile con scripts/extract-usda.mjs)
 *   2. legge database/staples-queries.json, che e' l'artefatto curato:
 *      nome italiano -> ricerca USDA
 *   3. risolve ogni ricerca scegliendo la voce che inizia col primo
 *      termine e non contiene parole da scartare
 *   4. applica gli override per i casi in cui la scelta automatica
 *      non e' quella giusta
 *   5. scrive il JSON e un report da controllare
 *
 * Se l'USDA cambia una descrizione, la query smette di risolvere e la voce
 * viene segnalata nel report invece di fallire in silenzio.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const curated = JSON.parse(readFileSync('database/staples-queries.json', 'utf8'));
const { queries, overrides = {}, manual = {}, cats = {} } = curated;

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

// ---------- output ----------

const json = JSON.stringify(rows);
writeFileSync('public/catalog.json', json);

const gzipBytes = gzipSync(json).length;
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

console.log(`public/catalog.json  ${rows.length} voci  ${kb(gzipBytes)} gzip\n`);

const toCheck = report.filter((r) => r.state !== 'ok');
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