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

Un solo file, da eseguire nel SQL Editor di Supabase:

```bash
database/schema.sql
```

Contiene tutto quello che serve, nell'ordine in cui va eseguito:

| Cosa | Contenuto |
|------|-----------|
| Tabelle | `profiles`, `shopping_lists`, `shopping_items`, `saved_products` |
| Indici | su proprietario, lista e stato di acquisto |
| RLS | attiva su ogni tabella, con policy che verificano `auth.uid()` |
| Trigger | `created_at` automatico |
| Storage | bucket `avatars`, privato, con policy per cartella utente |
| Funzioni | `add_or_update_item` e `save_product_for_reuse`, le due RPC che il frontend chiama per salvare. **Senza, l'app non salva nulla** |

È idempotente: puoi rieseguirlo quante volte vuoi senza errori.

Nel database stanno solo i tuoi dati: liste, prodotti, prodotti usati in precedenza.
Il **catalogo alimentare non è nel database**.

## Catalogo: USDA FoodData Central

I valori nutrizionali vengono da **USDA FoodData Central (SR Legacy)**, dati in
pubblico dominio (CC0 1.0). Non sono stime: sono analisi di laboratorio o calcoli
dell'USDA.

Il catalogo è un **file statico** servito dal CDN: nessuna tabella, nessuna
query, nessuna chiave API. 237 alimenti curati in italiano, ~10 KB gzip,
scaricati solo alla prima apertura della scheda Prodotti e poi tenuti in cache
dal service worker, quindi funziona anche offline.

Per rigenerarlo:

```bash
npm run build:catalog
```

Lo script legge due file e non interroghi mai il database:

- `database/staples-queries.json`: l'artefact curato, 326 nomi italiani
  abbinati alla ricerca USDA, con override e categorie
- `data/usda.json`: l'estratto dei dati USDA (7.518 voci)

Per ogni voce sceglie il candidato più plausibile, applica gli override dove
serve, e scrive `public/catalog.json`, versionato con il codice: per
aggiornare i valori basta `npm run build` e il deploy.

Il primo passaggio, cioè l'estrazione di `data/usda.json` dagli ZIP USDA, non
c'è più: lo script che lo faceva è stato rimosso e i CSV originali non sono
tracciati. Per ora puoi aggiornare i valori solo passando da
`database/staples-queries.json`. Se ti servono i CSV di partenza:

```bash
curl -sL -o sr.zip \
  "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip"
unzip -q sr.zip   # sono in ~/.gitignore, non finiscono nel repo
```

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
    FoodCard.jsx       → riga prodotto, con calorie e macronutrienti
    QuantityEditor.jsx → quantità scrivibile a mano
    UnitPicker.jsx     → selettore di unità
    SearchBar.jsx      → barra di ricerca
    EmptyState.jsx     → stati vuoti
    ThemeToggle.jsx    → chiaro/scuro
  hooks/
    useAuth.js          → sessione e profilo
    useShoppingList.js  → liste e prodotti
    useSavedProducts.js → prodotti usati in passato
    useFoodCatalog.js   → catalogo, categorie, ricerca
    useStepper.js       → quantità e unità scelte nei prodotti
    useTheme.js         → tema chiaro/scuro
  lib/
    schema.js    → nomi tabelle e colonne
    nutrition.js → conversioni e formattazione valori
    units.js     → unità disponibili e conversioni fra unità
    quantity.js  → arrotondamento e parsing delle quantità
    supabase.js  → client
test/            → vitest: nutrition, quantity, units, schema, security, wiring
scripts/         → build-catalog.mjs, make-icons.mjs
database/        → schema.sql (unico file SQL) e staples-queries.json
```

## Come funziona il catalogo

I valori sono sempre **per 100g**. Quando scegli una quantità, l'app la converte
in grammi e ricalcola:

- unità di peso o volume (`g`, `kg`, `ml`, `l`) → conversione diretta
- unità di conteggio (`pezzi`, `buste`, `scatole`) → quantità × `grams_per_unit`

## Funzionalità

- Login con email e password
- Più liste della spesa, creazione ed eliminazione
- Catalogo di 237 alimenti generici con valori USDA, ricerca senza accenti
- Stepper per la quantità con ricalcolo immediato di calorie e macronutrienti
- Aggiunta manuale come alternativa al catalogo
- Autocompletamento dai prodotti usati in precedenza
- Nessun duplicato: stesso nome (case-insensitive) → quantità sommate
- Spunta dei prodotti comprati, modifica inline, eliminazione
- PWA installabile, cache offline, indicatore di stato rete

## Script

```bash
npm run icons         # rigenera le icone PNG dell'app
npm run build:catalog # rigenera public/catalog.json
```