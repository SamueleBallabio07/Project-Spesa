# Project Spesa — istruzioni per gli agenti

App privata per la lista della spesa. React + Vite + Supabase, installabile
come PWA. Documentazione completa in `README.md`: leggila quando serve il
contesto, non è caricata automaticamente.

Lingua: commenti, messaggi di errore e stringhe UI in italiano. Rispondi in
italiano.

## Comandi

```bash
npm install
npm run dev       # server di sviluppo
npm run build     # build di produzione
npm run lint      # oxlint
npm test          # vitest, watch: usare `npm test -- --run` per una sola esecuzione
```

## Verifica obbligatoria

Prima di dichiarare un bugfix o una feature chiusa:

```bash
npm run lint && npm test -- --run && npm run build
```

Tutti e tre verdi. Se un comando fallisce per un motivo che hai introdotto tu,
correggi: non lasciare il fallimento e non "risolverlo" con `--force`.

## Architettura

- Il **catalogo alimentare non è nel database**. È `public/catalog.json`, un
  file statico generato da `scripts/build-catalog.mjs` a partire da
  `database/staples-queries.json` + `data/usda.json`. Nessuna tabella, nessuna
  query, nessuna chiave API.
- **`public/catalog.json` è generato: non editarlo mai a mano.** Si rigenera
  con `npm run build:catalog` e si committa il risultato.
- I valori nutrizionali sono **sempre per 100g** (convenzione USDA). La
  conversione in grammi avviene solo in `src/lib/nutrition.js`. Non introdurre
  valori "per porzione" in altri file.
- `src/lib/schema.js` deve corrispondere **esattamente** a `database/schema.sql`:
  nomi di tabelle e colonne. Modifiche allo schema si fanno su entrambi.
- Il DB è Supabase e la sicurezza poggia **interamente sulle RLS**. Ogni
  tabella nuova o policy nuova va accompanied da `ENABLE ROW LEVEL SECURITY` e
  da policy che verifichino `auth.uid()`. Vedi `.opencode/skills/supabase-change`.
- Il client usa solo la chiave publishable (`sb_publishable_…`), pubblica per
  design. Nessuna chiave `service_role` nel frontend, mai.

## Convenzioni

- Nomi di file in PascalCase per i componenti, camelCase per hook e lib.
- Le query Supabase passano sempre per le costanti `TABLES`/`COLUMNS` di
  `src/lib/schema.js`, mai stringhe letterali.
- Logica pura in `src/lib/`, accesso ai dati in `src/hooks/`, UI in
  `src/components/`. Non mescolarle.
- Commenti solo dove il perché non è ovvio. Niente commenti che ripetono il
  codice.
- Preferisci il refactor piccolo e verificabile alla riscrittura.

## Cosa non fare senza chiedere

- Non toccare `.env` e non leggere il suo contenuto.
- Non eseguire `git push`, `git commit`, `git reset`, `git checkout --` o
  `git clean`. Prepara le modifiche e chiedi.
- Non applicare SQL al database. `database/*.sql` si scrivono, l'esecuzione
  spetta all'utente nel SQL Editor di Supabase.
- Non aggiungere dipendenze senza chiedere. Giustifica prima la necessità.
- Non modificare `.github/workflows/` senza chiedere.
- Non eliminare `data/usda.json` né la cartella `FoodData_Central_sr_legacy_food_csv_2018-04/`
  (gitignored, serve a rigenerare il catalogo).

## Git

Commit in italiano, in stile conventional commits, come da `git log`:
`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`.
