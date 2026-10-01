/**
 * Importa USDA FoodData Central (SR Legacy) nel catalogo alimentare.
 *
 *   curl -sL -o sr.zip \
 *     "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip"
 *   unzip -q sr.zip
 *   node scripts/import-usda.mjs
 *
 * Legge i CSV nella cartella estratta e genera database/food_catalog_usda.sql.
 * I valori sono per 100g, cosi' come li pubblica l'USDA.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ---------- configurazione ----------

const SR_DIR = process.argv[2] || 'FoodData_Central_sr_legacy_food_csv_2018-04';
const OUT_FILE = 'database/food_catalog_usda.sql';

// ID nutrienti USDA (dalla documentazione dei download)
const N = {
  ENERGY: 1008, // Energy (kcal)
  PROTEIN: 1003, // Protein
  FAT: 1004, // Total lipid (fat)
  CARBS: 1005, // Carbohydrate, by difference
  FIBER: 1079, // Fiber, total dietary
};

const WANTED = new Set(Object.values(N));

// categorie da escludere: non sono alimenti
const SKIP_CATEGORIES = new Set(['Quality Control Materials']);

// SR Legacy contiene anche voci di marca (Pillsbury, Kraft Foods...).
// Non esiste un campo "brand" nei CSV, quindi filtriamo i marcatori
// societari espliciti. I restanti marchi minori restano nel catalogo:
// la selezione definitiva la fa il passaggio curato.
const BRAND_MARKERS =
  /\b(inc|co|co\.|corp|corp\.|company|ltd|llc|plc|gmbh|s\.?a|brands?|corporation|manufactur\w*|bakeries|bake ?shop|holdings)\b/i;

// Blocklist di marche alimentari frequenti in SR Legacy.
// Non esaustiva: serve a rimuovere il rumore evidente, non a certificare
// che ogni voce rimasta sia generica.
const KNOWN_BRANDS = [
  'pillsbury', 'kraft', 'kellogg', 'general mills', 'post foods', 'nestle', 'nestlé',
  'heinz', 'hellmann', 'best foods', 'carnation', 'george weston', 'starkist',
  'del monte', 'del monte', 'libby', 'libby mccall', 'swan', 'hosmer', 'armour',
  'van de kamps', 'borden', 'pet milk', 'carnation', 'merci finest', 'gerber',
  'mcdonald', 'mcdonald\'s', 'kfc', 'burger king', 'wendy', 'subway', 'domino',
  'pizza hut', 'taco bell', 'dunkin', 'starbucks', 'pepsi', 'pepsi-cola', 'coca-cola',
  'coca cola', 'dr pepper', 'sprite', 'fanta', 'schweppes', 'gatorade', 'red bull',
  'snapple', 'goya', 'old el paso', 'ortega', 'rosarita', 'buchanan', 'heinz',
  'hunt\'s', 'del monte', 'mueller', 'swan', 'green giant', 'birds eye', 'birds-eye',
  'stouffer', 'stouffer\'s', 'marriott', 'betty crocker', 'pillsbury doughboy',
  ' Pillsbury', ' Pillsbury', ' Pillsbury', 'taco', 'chef boyardee', 'hormel',
  'skinner', 'armour', 'starkist', 'chicken of the sea', 'van de kamp', 'gorton',
];

// porzioni in volume: non sono pezzi contabili.
// ids presi da measure_unit.csv, quindi affidabili; le regex sono solo una rete di sicurezza.
const VOLUME_UNITS = new Set([
  'cup',
  'tablespoon',
  'teaspoon',
  'Tablespoons',
  'liter',
  'milliliter',
  'cubic inch',
  'cubic centimeter',
  'gallon',
  'pint',
  'fl oz',
  'quart',
  'oz',
  'lb',
]);

const VOLUME_WORDS =
  /\b(cups?|t(bsp|s|ablespoons?)|tsp|fl(\.|\s)?oz|gallons?|pints?|quarts?|liters?|milliliters?|oz|ounces?|ml)\b/i;

const SIZE_PREFERRED = new Set(['medium', 'large', 'average', 'regular']);

// ---------- parsing CSV ----------
// Gestisce campi tra virgolette, virgolette doppie e a capo interni.

function* csvRows(file) {
  const text = readFileSync(file, 'utf8');
  let field = '';
  let row = [];
  let inQuotes = false;
  let started = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      started = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
      started = true;
    } else if (c === '\r') {
      // ignorato
    } else if (c === '\n') {
      if (started) {
        row.push(field);
        yield row;
      }
      field = '';
      row = [];
      started = false;
    } else {
      field += c;
      started = true;
    }
  }

  if (started) {
    row.push(field);
    yield row;
  }
}

function headerIndex(header) {
  const map = {};
  header.forEach((name, i) => {
    map[name.replace(/^"|"$/g, '')] = i;
  });
  return map;
}

// ---------- lettura tabelle ----------

function dirPath() {
  if (existsSync(SR_DIR)) return SR_DIR;
  // prova la cartella estratta anche se il nome ha spazi finali
  const candidate = readdirSync('.').find((n) => n.startsWith('FoodData_Central_sr_legacy'));
  if (candidate && existsSync(join('.', candidate))) return join('.', candidate);
  console.error(`Cartella SR Legacy non trovata: "${SR_DIR}"`);
  console.error('Scarica ed estrai lo ZIP, poi rilancia.');
  process.exit(1);
}

const dir = dirPath();
const path = (f) => join(dir, f);

// categorie
const categories = new Map();
for (const row of csvRows(path('food_category.csv'))) {
  if (row.length < 3) continue;
  categories.set(row[0], row[2]);
}

// alimenti
const foods = new Map();
for (const row of csvRows(path('food.csv'))) {
  if (row.length < 4) continue;
  foods.set(row[0], {
    description: row[2],
    categoryId: row[3],
  });
}

// nutrienti: tiene solo i 5 che ci servono
const nutrients = new Map();
let scannedNutrientRows = 0;
for (const row of csvRows(path('food_nutrient.csv'))) {
  if (row.length < 4) continue;
  scannedNutrientRows++;
  const nutrientId = Number(row[2]);
  if (!WANTED.has(nutrientId)) continue;
  const amount = Number(row[3]);
  if (!Number.isFinite(amount)) continue;

  const fdcId = row[1];
  if (!nutrients.has(fdcId)) nutrients.set(fdcId, {});
  nutrients.get(fdcId)[nutrientId] = amount;
}

// porzioni
const measureUnits = new Map();
for (const row of csvRows(path('measure_unit.csv'))) {
  if (row.length < 2) continue;
  measureUnits.set(row[0], row[1]);
}

const portions = new Map();
for (const row of csvRows(path('food_portion.csv'))) {
  if (row.length < 8) continue;
  const fdcId = row[1];
  const amount = Number(row[3]);
  const gramWeight = Number(row[7]);
  if (!Number.isFinite(amount) || !Number.isFinite(gramWeight) || amount <= 0 || gramWeight <= 0) continue;

  const unitName = measureUnits.get(row[4]) || '';
  if (VOLUME_UNITS.has(unitName)) continue;

  if (!portions.has(fdcId)) portions.set(fdcId, []);
  portions.get(fdcId).push({
    amount,
    gramWeight,
    description: row[5] || '',
    modifier: row[6] || '',
  });
}

// ---------- scelta della porzione ----------
// Cerchiamo il peso di "un pezzo". Se non esiste, usiamo i grammi.

function pickPortion(list) {
  if (!list || !list.length) return null;

  const usable = list.filter((p) => {
    const gramsPerUnit = p.gramWeight / p.amount;
    if (gramsPerUnit < 1 || gramsPerUnit > 500) return false;
    const label = `${p.description} ${p.modifier}`;
    if (VOLUME_WORDS.test(label)) return false;
    return true;
  });

  if (!usable.length) return null;

  const single = usable.filter((p) => Math.round(p.amount * 100) / 100 === 1);
  const pool = single.length ? single : usable;

  // preferisce una taglia nota (medium, large): e' il pezzo "di riferimento"
  const sized = pool.filter((p) => SIZE_PREFERRED.has(p.modifier.toLowerCase().trim()));
  if (sized.length) {
    // "medium" prima di "large" quando entrambe ci sono
    const medium = sized.find((p) => p.modifier.toLowerCase().trim() === 'medium');
    if (medium) return medium;
    return sized[0];
  }

  return pool[0];
}

// ---------- join e pulizia ----------

const rows = [];
let skippedNoKcal = 0;
let skippedCategory = 0;
let skippedBrand = 0;

for (const [fdcId, food] of foods) {
  const n = nutrients.get(fdcId);
  if (!n || n[N.ENERGY] === undefined) {
    skippedNoKcal++;
    continue;
  }

  const category = categories.get(food.categoryId) || 'Altro';
  if (SKIP_CATEGORIES.has(category)) {
    skippedCategory++;
    continue;
  }

  if (BRAND_MARKERS.test(food.description) || KNOWN_BRANDS.some((b) => food.description.toLowerCase().includes(b))) {
    skippedBrand++;
    continue;
  }

  const portion = pickPortion(portions.get(fdcId));
  const countable = portion && Math.round(portion.amount * 100) / 100 === 1;

  const unitDefault = countable ? 'pezzi' : 'g';
  const gramsPerUnit = countable ? round(portion.gramWeight / portion.amount, 2) : 1;

  rows.push({
    fdcId,
    name: food.description,
    category,
    unitDefault,
    gramsPerUnit,
    kcal: round(n[N.ENERGY] ?? 0, 1),
    protein: round(n[N.PROTEIN] ?? 0, 2),
    carbs: round(n[N.CARBS] ?? 0, 2),
    fat: round(n[N.FAT] ?? 0, 2),
    fiber: round(n[N.FIBER] ?? 0, 2),
    sizeLabel: countable ? (portion.modifier || portion.description || '').trim() : '',
  });
}

function round(value, digits) {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

// nome breve per la UI: parte prima della prima virgola,
// se il pezzo e' ancora leggibile ("Milk" da "Milk, whole, 3.25% milkfat")
function shortName(description) {
  const head = description.split(',')[0].trim();
  return head.length >= 3 && head.length <= 32 ? head : description;
}

// ---------- generazione SQL ----------

const q = (value) => `'${String(value ?? '').replace(/'/g, "''")}'`;
const n = (value) => (Number.isFinite(value) ? String(value) : '0');

const header = `-- ============================================================
-- CATALOGO ALIMENTARI DA USDA FoodData Central (SR Legacy)
-- Generato automaticamente: non modificare a mano.
-- Fonte: U.S. Department of Agriculture, Agricultural Research
-- Service. FoodData Central. Dati in pubblico dominio (CC0 1.0).
-- ${rows.length} alimenti generici, valori nutrizionali per 100g.
--
-- I valori sono analitici o calcolati dall'USDA, non stimati.
-- "label_it" resta vuoto: compilalo per mostrare i nomi in italiano.
-- ============================================================

TRUNCATE TABLE food_catalog;

`;

const columns = `  (fdc_id, name, short_name, label_it, usda_category, unit_default,
   grams_per_unit, kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g,
   size_label, verified)`;

const values = (r) =>
  `  (${Number(r.fdcId)}, ${q(r.name)}, ${q(shortName(r.name))}, NULL, ${q(r.category)}, ` +
  `${q(r.unitDefault)}, ${n(r.gramsPerUnit)}, ${n(r.kcal)}, ${n(r.protein)}, ${n(r.carbs)}, ` +
  `${n(r.fat)}, ${n(r.fiber)}, ${q(r.sizeLabel)}, true)`;

const BATCH = 250;
const parts = [header];

for (let i = 0; i < rows.length; i += BATCH) {
  const slice = rows.slice(i, i + BATCH);
  parts.push(
    `INSERT INTO food_catalog ${columns} VALUES\n${slice.map(values).join(',\n')};`
  );
}

parts.push(
  `\n\n-- ${rows.length} alimenti inseriti.\n` +
    `-- Scartati: ${skippedNoKcal} senza calorie, ${skippedCategory} non alimenti, ${skippedBrand} di marca.\n`
);

writeFileSync(OUT_FILE, parts.join('\n'));

// ---------- riepilogo ----------

const withPieces = rows.filter((r) => r.unitDefault === 'pezzi').length;
const categoriesCount = new Set(rows.map((r) => r.category)).size;

console.log(`Scritte ${OUT_FILE}`);
console.log(`  alimenti:      ${rows.length}`);
console.log(`  categorie:     ${categoriesCount}`);
console.log(`  con "pezzi":   ${withPieces}`);
console.log(`  scartati senza calorie: ${skippedNoKcal}`);
console.log(`  scartati non-alimenti:  ${skippedCategory}`);
console.log(`  scartati di marca:      ${skippedBrand}`);