/**
 * Costruisce il catalogo alimentare da USDA FoodData Central (SR Legacy)
 * e lo scrive come file statico: public/catalog.json.
 *
 * Nessun database, nessuna chiave API: il catalogo viaggia con l'app.
 *
 *   curl -sL -o sr.zip \
 *     "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip"
 *   unzip -q sr.zip
 *   node scripts/build-catalog.mjs
 *
 * I valori sono per 100g, come li pubblica l'USDA.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const SR_DIR = process.argv[2] || 'FoodData_Central_sr_legacy_food_csv_2018-04';
const OUT_FILE = 'public/catalog.json';

// ID nutrienti USDA (dalla documentazione dei download)
const N = {
  ENERGY: 1008,
  PROTEIN: 1003,
  FAT: 1004,
  CARBS: 1005,
  FIBER: 1079,
};

const WANTED = new Set(Object.values(N));

const SKIP_CATEGORIES = new Set(['Quality Control Materials']);

// SR Legacy contiene anche voci di marca. Non esiste un campo "brand",
// quindi filtriamo i marcatori societari piu' una blocklist di marche note.
// Non esaustiva: la pulizia finale la fa la selezione curata.
const BRAND_MARKERS =
  /\b(inc|co|co\.|corp|corp\.|company|ltd|llc|plc|gmbh|s\.?a|brands?|corporation|manufactur\w*|bakeries|bake ?shop|holdings)\b/i;

const KNOWN_BRANDS = [
  'pillsbury', 'kraft', 'kellogg', 'general mills', 'post foods', 'nestle', 'nestlé',
  'heinz', 'hellmann', 'best foods', 'carnation', 'george weston', 'starkist',
  'del monte', 'libby', 'swan', 'hosmer', 'armour', 'van de kamps', 'borden',
  'pet milk', 'merci finest', 'gerber', 'mcdonald', 'kfc', 'burger king', 'wendy',
  'subway', 'domino', 'pizza hut', 'taco bell', 'dunkin', 'starbucks', 'pepsi',
  'pepsi-cola', 'coca-cola', 'coca cola', 'dr pepper', 'sprite', 'fanta', 'schweppes',
  'gatorade', 'red bull', 'snapple', 'goya', 'old el paso', 'ortega', 'rosarita',
  'buchanan', 'hunt\'s', 'mueller', 'green giant', 'birds eye', 'birds-eye',
  'stouffer', 'stouffer\'s', 'betty crocker', 'chef boyardee', 'hormel',
  'gorton', 'chicken of the sea',
];

// Porzioni in volume: non sono pezzi contabili.
// ID presi da measure_unit.csv, quindi affidabili.
const VOLUME_UNITS = new Set([
  'cup', 'tablespoon', 'teaspoon', 'Tablespoons', 'liter', 'milliliter',
  'cubic inch', 'cubic centimeter', 'gallon', 'pint', 'fl oz', 'quart', 'oz', 'lb',
]);

const VOLUME_WORDS =
  /\b(cups?|t(bsp|s|ablespoons?)|tsp|fl(\.|\s)?oz|gallons?|pints?|quarts?|liters?|milliliters?|oz|ounces?|ml)\b/i;

const SIZE_PREFERRED = new Set(['medium', 'large', 'average', 'regular']);

// ---------- parsing CSV ----------

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

// ---------- lettura tabelle ----------

function resolveDir() {
  if (existsSync(SR_DIR)) return SR_DIR;
  const candidate = readdirSync('.').find((n) => n.startsWith('FoodData_Central_sr_legacy'));
  if (candidate && existsSync(join('.', candidate))) return join('.', candidate);
  console.error(`Cartella SR Legacy non trovata: "${SR_DIR}"`);
  console.error('Scarica ed estrai lo ZIP, poi rilancia.');
  process.exit(1);
}

const dir = resolveDir();
const path = (f) => join(dir, f);

const categories = new Map();
for (const row of csvRows(path('food_category.csv'))) {
  if (row.length >= 3) categories.set(row[0], row[2]);
}

const foods = new Map();
for (const row of csvRows(path('food.csv'))) {
  if (row.length >= 4) foods.set(row[0], { description: row[2], categoryId: row[3] });
}

const nutrients = new Map();
for (const row of csvRows(path('food_nutrient.csv'))) {
  if (row.length < 4) continue;
  const nutrientId = Number(row[2]);
  if (!WANTED.has(nutrientId)) continue;
  const amount = Number(row[3]);
  if (!Number.isFinite(amount)) continue;
  const fdcId = row[1];
  if (!nutrients.has(fdcId)) nutrients.set(fdcId, {});
  nutrients.get(fdcId)[nutrientId] = amount;
}

const measureUnits = new Map();
for (const row of csvRows(path('measure_unit.csv'))) {
  if (row.length >= 2) measureUnits.set(row[0], row[1]);
}

const portions = new Map();
for (const row of csvRows(path('food_portion.csv'))) {
  if (row.length < 8) continue;
  const amount = Number(row[3]);
  const gramWeight = Number(row[7]);
  if (!Number.isFinite(amount) || !Number.isFinite(gramWeight) || amount <= 0 || gramWeight <= 0) continue;

  const unitName = measureUnits.get(row[4]) || '';
  if (VOLUME_UNITS.has(unitName)) continue;

  const fdcId = row[1];
  if (!portions.has(fdcId)) portions.set(fdcId, []);
  portions.get(fdcId).push({
    amount,
    gramWeight,
    description: row[5] || '',
    modifier: row[6] || '',
  });
}

// ---------- scelta della porzione ----------

function pickPortion(list) {
  if (!list || !list.length) return null;

  const usable = list.filter((p) => {
    const gramsPerUnit = p.gramWeight / p.amount;
    if (gramsPerUnit < 1 || gramsPerUnit > 500) return false;
    return !VOLUME_WORDS.test(`${p.description} ${p.modifier}`);
  });

  if (!usable.length) return null;

  const single = usable.filter((p) => Math.round(p.amount * 100) / 100 === 1);
  const pool = single.length ? single : usable;

  const sized = pool.filter((p) => SIZE_PREFERRED.has(p.modifier.toLowerCase().trim()));
  if (sized.length) {
    const medium = sized.find((p) => p.modifier.toLowerCase().trim() === 'medium');
    return medium || sized[0];
  }

  return pool[0];
}

// nome breve: parte prima della prima virgola, se leggibile
function shortName(description) {
  const head = description.split(',')[0].trim();
  return head.length >= 3 && head.length <= 32 ? head : description;
}

const round = (value, digits) => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

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

  const row = {
    id: Number(fdcId),
    name: food.description,
    sn: shortName(food.description),
    cat: category,
    unit: countable ? 'pezzi' : 'g',
    gpu: countable ? round(portion.gramWeight / portion.amount, 2) : 1,
    kcal: round(n[N.ENERGY] ?? 0, 1),
    p: round(n[N.PROTEIN] ?? 0, 2),
    c: round(n[N.CARBS] ?? 0, 2),
    f: round(n[N.FAT] ?? 0, 2),
    fib: round(n[N.FIBER] ?? 0, 2),
  };

  if (countable) {
    const size = (portion.modifier || portion.description || '').trim();
    if (size) row.size = size;
  }

  rows.push(row);
}

// ---------- output ----------

const json = JSON.stringify(rows);
writeFileSync(OUT_FILE, json);

const rawBytes = Buffer.byteLength(json);
const gzipBytes = gzipSync(json).length;
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

console.log(`Scritte ${OUT_FILE}`);
console.log(`  alimenti:             ${rows.length}`);
console.log(`  categorie:            ${new Set(rows.map((r) => r.cat)).size}`);
console.log(`  con unita' "pezzi":   ${rows.filter((r) => r.unit === 'pezzi').length}`);
console.log(`  grezzo:               ${kb(rawBytes)}`);
console.log(`  compresso (gzip):     ${kb(gzipBytes)}   ~${(gzipBytes / rows.length).toFixed(0)} byte per riga`);
console.log(`  scartati: ${skippedNoKcal} senza calorie, ${skippedCategory} non alimenti, ${skippedBrand} di marca`);