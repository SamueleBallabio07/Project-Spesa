-- ============================================
-- CATALOGO ALIMENTARI
-- Dati base senza marchio, con valori nutrizionali
-- per 100g. Valori INDICATIVI: flag `verified` = false
-- finche' non controllati su fonte autorevole.
-- ============================================

CREATE TABLE IF NOT EXISTS food_catalog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  aliases TEXT[] DEFAULT '{}',
  category TEXT NOT NULL,
  unit_default TEXT NOT NULL DEFAULT 'g',
  grams_per_unit NUMERIC,
  kcal_100g NUMERIC NOT NULL,
  protein_100g NUMERIC NOT NULL DEFAULT 0,
  carbs_100g NUMERIC NOT NULL DEFAULT 0,
  fat_100g NUMERIC NOT NULL DEFAULT 0,
  fiber_100g NUMERIC DEFAULT 0,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_food_catalog_category ON food_catalog(category);
CREATE INDEX IF NOT EXISTS idx_food_catalog_name ON food_catalog(lower(name) text_pattern_ops);

-- Solo lettura per gli utenti: il catalogo si popola da SQL Editor.
ALTER TABLE food_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read food_catalog" ON food_catalog;
CREATE POLICY "Users can read food_catalog" ON food_catalog
  FOR SELECT TO authenticated USING (true);