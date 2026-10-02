-- ============================================
-- VERIFICA SICUREZZA (solo SELECT: non modifica nulla)
-- ============================================
-- Da eseguire dopo schema.sql e fix-unique.sql.
-- La sicurezza dell'app dipende interamente dalle RLS: la chiave publishable
-- nel bundle e pubblica per design, quindi l'unica barriera sono queste regole.

-- 1. Copertura RLS: ogni tabella deve avere relrowsecurity = true.
--    Una tabella con false e leggibile e scrivibile da chiunque abbia la
--    chiave publishable.
SELECT
  c.relname AS tabella,
  c.relrowsecurity AS rls_attiva,
  CASE WHEN c.relrowsecurity THEN 'ok' ELSE 'MANCANZA CRITICA' END AS stato
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname <> 'schema_migrations'
ORDER BY c.relrowsecurity, c.relname;

-- 2. Policy per tabella. Confronta con le operazioni usate in src/hooks/:
--    una tabella con 0 policy e una tabella che non ha ancora RLS.
SELECT
  tablename AS tabella,
  COUNT(*) AS policy,
  string_agg(DISTINCT cmd, ', ') AS operazioni
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- 3. Le 4 policy su saved_products devono esserci tutte.
--    Questa tabella esisteva senza alcuna RLS: era la falla principale.
SELECT policyname, cmd, qual AS usando, with_check AS con_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'saved_products'
ORDER BY policyname;

-- 4. Ogni policy che concede SELECT deve filtrare per l'utente.
--    Una policy senza auth.uid() non e' una protezione.
SELECT
  tablename,
  policyname,
  cmd,
  qual AS espressione
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd IN ('SELECT', 'ALL')
  AND (qual IS NULL OR qual NOT ILIKE '%auth.uid%')
ORDER BY tablename, policyname;
-- L'ultima query DEVE restituire 0 righe. Se ne restituisce qualcuna, quella
-- policy lascia passare dati di altri utenti.

-- 5. Vincolo per l'upsert dei prodotti salvati.
--    Se torna 0 righe, fix-unique.sql non e' stato eseguito.
SELECT conname AS vincolo
FROM pg_constraint
WHERE conrelid = 'saved_products'::regclass
  AND contype = 'u';

-- 6. Bucket avatar: public deve essere false.
--    Con true, le RLS non proteggono la lettura: ogni URL di avatar e pubblico.
SELECT id, name, public
FROM storage.buckets
WHERE id = 'avatars';

-- 7. Quante righe contiene ogni tabella: serve per capire se i fix hanno
--    toccato dati reali. Confronta prima e dopo.
SELECT 'profiles' AS tabella, COUNT(*) AS righe FROM profiles
UNION ALL SELECT 'shopping_lists', COUNT(*) FROM shopping_lists
UNION ALL SELECT 'shopping_items', COUNT(*) FROM shopping_items
UNION ALL SELECT 'saved_products', COUNT(*) FROM saved_products
UNION ALL SELECT 'list_memberships', COUNT(*) FROM list_memberships
UNION ALL SELECT 'list_invitations', COUNT(*) FROM list_invitations;

-- 8. Conferma che nessuna tabella resti scoperta, in una riga sola.
SELECT
  COUNT(*) FILTER (WHERE NOT c.relrowsecurity) AS tabelle_senza_rls,
  CASE
    WHEN COUNT(*) FILTER (WHERE NOT c.relrowsecurity) = 0
      THEN 'SICUREZZA OK: ogni tabella ha RLS'
    ELSE 'NON PUBBLICARE: ci sono tabelle senza RLS'
  END AS esito
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r';
