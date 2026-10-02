---
name: Supabase Change
description: Workflow per modificare schema, RLS e policy di un'app Supabase senza rompere la sicurezza. Usala quando devi aggiungere o cambiare tabelle, colonne, policy RLS, o quando un hook inizia a usare una tabella nuova.
---

Il frontend usa una chiave publishable pubblica: **la sicurezza poggia
interamente sulle RLS**. Una tabella senza RLS è leggibile e scrivibile da
chiunque abbia la chiave. Tratta ogni `CREATE TABLE` come se fosse già
pericoloso finché non hai scritto le policy.

Non applichi mai SQL al database. Scrivi il file, l'utente lo esegue nel SQL
Editor di Supabase.

## Workflow

1. **Leggi lo stato attuale.** `database/schema.sql` per tabelle, colonne,
   RLS e policy. `src/lib/schema.js` per le costanti che il frontend usa.
   `src/hooks/*.js` per capire come ogni tabella viene interrogata.

2. **Decidi la forma minima.** Ogni tabella ha bisogno di: RLS attiva,
   almeno una policy per operazione usata, e filtro su `auth.uid()`.
   Se una tabella serve solo a te, `user_id` con policy per-owner è sufficiente
   e va bene.

3. **Scrivi SQL idempotente.** Il file viene riletto e riapplicato: usa sempre
   `CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS` prima di ogni
   `CREATE POLICY`, e `CREATE INDEX IF NOT EXISTS`. Così lo stesso file può
   essere eseguito due volte senza errori né duplicati.

4. **Aggiorna `src/lib/schema.js` nello stesso intervento.** Aggiungi la
   tabella a `TABLES` e tutte le colonne a `COLUMNS`, con lo stesso nome
   esatto usato nel SQL. Se divergono, le query falliscono a runtime con un
   errore poco informativo.

5. **Verifica con l'auditor.** Lancia il subagent `supabase-auditor`: controlla
   copertura RLS, completezza delle policy e coerenza con `schema.js`.

6. **Istruisci l'utente.** Elenca i file da eseguire nell'ordine e le tabelle
   toccate, e ricorda che le policy si applicano alle righe nuove: se cambi
   una policy in senso restrittivo, le righe esistenti vanno rilette.

## Regole di sicurezza

- **Mai una policy senza `auth.uid()`.** Nemmeno per una tabella "privata":
  la chiave publishable è pubblica, quindi privato per utente significa
  filtrato per `auth.uid()`.
- **Le liste condivise passano da `list_memberships`.** L'accesso a
  `shopping_items` passa per `shopping_lists.owner_id = auth.uid()`. Se
  introduci la condivisione, coinvolgi le membership nella policy: controllare
  solo `owner_id` escluderebbe i membri, e aprire il controllo a chiunque
  includerebbe estranei.
- **Niente chiavi `service_role` nel frontend**, nemmeno in un test che finisce
  nel bundle. La chiave publishable è pubblica per design.
- **`storage.objects`**: ogni bucket ha policy che verificano
  `storage.foldername(name)[1] = auth.uid()::text`.
- **Gli upsert richiedono un vincolo.** `onConstraint` in un upsert del
  frontend funziona solo se il `UNIQUE` corrispondente esiste davvero nel
  database. Se manca, l'errore va gestito esplicitamente nel codice: un
  errore ignorato è un fallimento silenzioso.

## Colonne di ownership

Le tabelle che contengono dati utente portano `user_id UUID NOT NULL
REFERENCES auth.users(id) ON DELETE CASCADE`. Il `CASCADE` fa sì che
l'eliminazione dell'utente porti via i suoi dati: senza, gli insert con
`ON DELETE CASCADE` falliscono e l'utente non si può più cancellare.
