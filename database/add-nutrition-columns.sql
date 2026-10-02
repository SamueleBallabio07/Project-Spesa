-- ============================================
-- MIGRAZIONE: Colonne nutrizionali per shopping_items e saved_products
-- Eseguire in Supabase SQL Editor
-- ============================================

-- Aggiunge colonne nutrizionali a shopping_items (valori per 100g, convenzione USDA)
ALTER TABLE shopping_items
  ADD COLUMN IF NOT EXISTS kcal100g NUMERIC,
  ADD COLUMN IF NOT EXISTS protein100g NUMERIC,
  ADD COLUMN IF NOT EXISTS carbs100g NUMERIC,
  ADD COLUMN IF NOT EXISTS fat100g NUMERIC,
  ADD COLUMN IF NOT EXISTS fiber100g NUMERIC;

-- Aggiunge colonne nutrizionali a saved_products
ALTER TABLE saved_products
  ADD COLUMN IF NOT EXISTS kcal100g NUMERIC,
  ADD COLUMN IF NOT EXISTS protein100g NUMERIC,
  ADD COLUMN IF NOT EXISTS carbs100g NUMERIC,
  ADD COLUMN IF NOT EXISTS fat100g NUMERIC,
  ADD COLUMN IF NOT EXISTS fiber100g NUMERIC;

-- Indici per query per categorie (opzionale, per performance future)
CREATE INDEX IF NOT EXISTS idx_shopping_items_kcal ON shopping_items(kcal100g);
CREATE INDEX IF NOT EXISTS idx_saved_products_kcal ON saved_products(kcal100g);

SELECT 'Colonne nutrizionali aggiunte con successo!' AS message;