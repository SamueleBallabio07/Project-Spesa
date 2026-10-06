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
Il **catalogo non è nel database**.

## Catalogo

Il catalogo è un **file statico** servito dal CDN: nessuna tabella, nessuna
query, nessuna chiave API. **432 voci** curate in italiano, ~13 KB gzip,
scaricate solo alla prima apertura della scheda Prodotti e poi tenute in cache
dal service worker, quindi funziona anche offline.

Copre due domini:

| Dominio | Sono | Valori nutrizionali | Origine |
|---------|------|---------------------|---------|
| `food` | 237 commestibili | sì, per 100g | USDA FoodData Central (SR Legacy) |
| `house` | 195 non commestibili: detersivi, carta, igiene personale, casalinghi, animali, ufficio, giardinaggio | **no** | curate a mano |

I valori nutrizionali del cibo vengono da USDA FoodData Central, dati in pubblico
dominio (CC0 1.0). Non sono stime: sono analisi di laboratorio o calcoli
dell'USDA.

I prodotti non commestibili non hanno calorie perché non esistono: nel catalogo
i loro nutrienti sono `null`. **A decidere se mostrare le calorie è la presenza
della nutrizione, non il dominio**: anche una voce aggiunta a mano senza calorie
resta senza calorie.

Per rigenerarlo:

```bash
npm run build:catalog
```

Lo script legge due file e non interroga mai il database:

- `database/catalog-taxonomy.json`: l'artefact curato. Per il cibo, 326 nomi
  italiani abbinati alla ricerca USDA, con override e categorie. Per la casa, un
  blocco `house` in cui ogni voce porta la sua categoria e la sua unità
- `data/usda.json`: l'estratto dei dati USDA (7.518 voci)

Per ogni voce di cibo sceglie il candidato più plausibile e applica gli override
dove serve; le voci di casa entrano così come sono. Poi scrive
`public/catalog.json`, versionato con il codice: per aggiornare i valori basta
`npm run build` e il deploy.

Per aggiungere prodotti per casa basta una riga nel blocco `house`:

```json
"Detersivo piatti": { "cat": "Detersivi", "unit": "pezzi" }
```

Lo script **rifiuta** una voce `house` che abbia campi nutrizionali o `gpu`: se
un giorno serve, non è un prodotto non commestibile e sta nel blocco sbagliato.
`test/schema.test.js` fissa lo stesso invariante sul catalogo generato.

Il primo passaggio, cioè l'estrazione di `data/usda.json` dagli ZIP USDA, non
c'è più: lo script che lo faceva è stato rimosso e i CSV originali non sono
tracciati. Per ora puoi aggiornare i valori solo passando da
`database/catalog-taxonomy.json`. Se ti servono i CSV di partenza:

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
database/        → schema.sql (unico file SQL) e catalog-taxonomy.json
```

## Come funziona il catalogo

I valori sono sempre **per 100g**. Quando scegli una quantità, l'app la converte
in grammi e ricalcola:

- unità di peso o volume (`g`, `kg`, `ml`, `l`) → conversione diretta
- unità di conteggio (`pezzi`, `buste`, `scatole`) → quantità × `grams_per_unit`

## Funzionalità

- Login con email e password
- Più liste della spesa, creazione ed eliminazione
- Catalogo di 432 voci: 237 alimenti con valori USDA e 195 prodotti per casa
- Due domini separati (Cibo, Casa) con le categorie di ciascuno
- Ricerca senza accenti, su tutto il catalogo
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