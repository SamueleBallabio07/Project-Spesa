-- ============================================
-- FIX: vincolo UNIQUE su saved_products
-- ============================================
-- Perche' serve:
--   useShoppingList.js salva i "prodotti usati in precedenza" con
--     upsert([...], { onConstraint: 'user_id,name' })
--   Il vincolo UNIQUE (user_id, name) e' il presupposto di quell'upsert.
--   Non essendoci, ogni salvataggio falliva. Errore gia' segnalato in
--   console, ma il prodotto non veniva salvato.
--
-- Perche' non e' gia' a posto:
--   Il vincolo era scritto dentro CREATE TABLE IF NOT EXISTS saved_products.
--   La tabella esisteva gia', quindi l'intera CREATE TABLE e' stata saltata
--   e il vincolo non e' mai arrivato nel database. Solo ALTER TABLE agisce
--   su una tabella gia' esistente.
--
-- Idempotente: puoi eseguire questo file piu' volte senza errori.

-- 1. Duplicati attuali (solo lettura: non modifica nulla).
--    Se la tabella "Duplicati" restituisce 0 righe, il passo 2 non fa nulla.
SELECT user_id, name, COUNT(*) AS occorrenze
FROM saved_products
GROUP BY user_id, name
HAVING COUNT(*) > 1
ORDER BY occorrenze DESC;

-- 2. Accorpa i duplicati, tenendo la riga piu' recente.
--    Solo prodotti salvati per riutilizzo: dati derivati, nessuna
--    conseguenza sulla lista della spesa. Se preferisci gestirli a mano,
--    commenta questo blocco: il vincolo fallira' e vedrai l'errore.
DELETE FROM saved_products a
USING saved_products b
WHERE a.user_id = b.user_id
  AND a.name = b.name
  AND (a.created_at, a.id) < (b.created_at, b.id);

-- 3. Aggiunge il vincolo solo se non esiste gia'.
DROP INDEX IF EXISTS saved_products_user_name_key;
ALTER TABLE saved_products
  ADD CONSTRAINT saved_products_user_name_key UNIQUE (user_id, name);

-- 4. Verifica: l'upsert del frontend ora trova il suo presupposto.
SELECT conname AS vincolo, contype AS tipo
FROM pg_constraint
WHERE conrelid = 'saved_products'::regclass
  AND conname = 'saved_products_user_name_key';

SELECT 'Vincolo UNIQUE applicato. Rilancia schema.sql non serve.' AS esito;
