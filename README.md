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
| `database/food_catalog.sql` | Tabella del catalogo alimentare |
| `database/food_catalog_seed.sql` | ~85 alimenti base con valori nutrizionali |

Il catalogo si popola solo da SQL: la policy RLS consente la lettura ma non
la scrittura dal client.

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

Ogni riga ha un flag `verified`, `false` di default: i valori iniziali sono
indicativi. Passalo a `true` solo dopo averli controllati su una fonte
autorevole (es. USDA FoodData Central) se ti servono per calcolare una dieta.

## Funzionalità

- Login con email e password
- Più liste della spesa, creazione ed eliminazione
- Catalogo alimentare con valori nutrizionali e ricerca su alias senza accenti
- Stepper per la quantità con ricalcolo immediato di calorie e macronutrienti
- Aggiunta manuale come alternativa al catalogo
- Autocompletamento dai prodotti usati in precedenza
- Nessun duplicato: stesso nome (case-insensitive) → quantità sommate
- Spunta dei prodotti comprati, modifica inline, eliminazione
- PWA installabile, cache offline, indicatore di stato rete

## Script

```bash
node scripts/make-icons.mjs   # rigenera le icone PNG dell'app
```