# Project Spesa

App privata per la lista della spesa. React + Vite + Supabase, installabile come PWA su iOS e Android.

## Avvio

```bash
npm install
npm run dev
```

## Configura

Crea un file `.env` nella root:

```
VITE_SUPABASE_URL=https://tuo-progetto.supabase.co
VITE_SUPABASE_ANON_KEY=tua-anon-key
```

## Database

Esegui in ordine, nel SQL Editor di Supabase:

| File | Cosa fa |
|------|---------|
| `database/schema.sql` | Tabelle core, RLS, indici, storage avatar |
| `database/remove-duplicates.sql` | Pulisce i prodotti duplicati |

Nel database stanno solo i tuoi dati: liste, prodotti, prodotti usati in precedenza.
Il **catalogo alimentare non è nel database**.

## Catalogo: USDA FoodData Central

I valori nutrizionali vengono da **USDA FoodData Central (SR Legacy)**, dati in
pubblico dominio (CC0 1.0). Non sono stime: sono analisi di laboratorio o calcoli
dell'USDA.

Il catalogo è un **file statico** servito dal CDN: nessuna tabella, nessuna
query, nessuna chiave API. ~7.500 alimenti compressi in 240 KB, scaricati solo
alla prima apertura della scheda Prodotti e poi tenuti in cache dal service
worker, quindi funziona anche offline.

Per rigenerarlo:

```bash
curl -sL -o sr.zip \
  "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip"
unzip -q sr.zip
node scripts/build-catalog.mjs
```

Lo script unisce quattro CSV (`food`, `food_nutrient`, `food_portion`,
`food_category`), estrae i cinque nutrienti necessari e sceglie il peso di "un
pezzo" dalle porzioni USDA scartando quelle in volume. Poi scrive
`public/catalog.json`, versionato con il codice: per aggiornare i valori basta
`npm run build` e il deploy.

Note sui dati:

- **Per 100g**: i valori seguono la convenzione USDA, la conversione in
  grammi la fa `src/lib/nutrition.js`
- `unit` è `pezzi` solo se esiste una porzione singola non in volume, altrimenti `g`
- Le voci con marche note vengono scartate, ma la blocklist non è esaustiva:
  la selezione definitiva la fa il passaggio curato
- I nomi sono in inglese come li pubblica l'USDA; il campo `sn` è la versione
  breve per la UI

## Struttura

```
src/
  components/
    Auth.jsx           → login/registrazione
    ShoppingList.jsx   → scheda Liste
    CatalogScreen.jsx  → scheda Prodotti (catalogo)
    TabBar.jsx         → navigazione inferiore iOS
  hooks/
    useAuth.js          → sessione e profilo
    useShoppingList.js  → liste e prodotti
    useSavedProducts.js → prodotti usati in passato
    useFoodCatalog.js   → catalogo, categorie, ricerca
    useOfflineSync.js   → stato rete e coda offline
  lib/
    schema.js    → nomi tabelle e colonne
    nutrition.js → conversioni e formattazione valori
    supabase.js  → client
```

## Come funziona il catalogo

I valori sono sempre **per 100g**. Quando scegli una quantità, l'app la converte
in grammi e ricalcola:

- unità di peso o volume (`g`, `kg`, `ml`, `l`) → conversione diretta
- unità di conteggio (`pezzi`, `buste`, `scatole`) → quantità × `grams_per_unit`

## Funzionalità

- Login con email e password
- Più liste della spesa, creazione ed eliminazione
- Catalogo di ~7.500 alimenti generici con valori USDA, ricerca senza accenti
- Stepper per la quantità con ricalcolo immediato di calorie e macronutrienti
- Aggiunta manuale come alternativa al catalogo
- Autocompletamento dai prodotti usati in precedenza
- Nessun duplicato: stesso nome (case-insensitive) → quantità sommate
- Spunta dei prodotti comprati, modifica inline, eliminazione
- PWA installabile, cache offline, indicatore di stato rete

## Script

```bash
node scripts/make-icons.mjs     # rigenera le icone PNG dell'app
node scripts/build-catalog.mjs  # rigenera public/catalog.json dagli ZIP USDA
```