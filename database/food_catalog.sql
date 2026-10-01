-- ============================================================
-- CATALOGO ALIMENTARI
-- I dati arrivano da USDA FoodData Central (SR Legacy) tramite
-- scripts/import-usda.mjs -> database/food_catalog_usda.sql
--
-- I valori sono per 100g. Popolamento e refresh: solo da SQL,
-- la policy RLS consente la lettura ma non la scrittura.
-- ============================================================

DROP TABLE IF EXISTS food_catalog;

CREATE TABLE food_catalog (
  fdc_id           INTEGER PRIMARY KEY,          -- id USDA, stabile nel tempo
  name             TEXT NOT NULL,               -- descrizione originale USDA
  short_name       TEXT,                        -- nome breve per la UI
  label_it         TEXT,                        -- nome in italiano, da curare
  usda_category    TEXT NOT NULL,
  unit_default     TEXT NOT NULL DEFAULT 'g',
  grams_per_unit   NUMERIC,
  kcal_100g        NUMERIC NOT NULL DEFAULT 0,
  protein_100g     NUMERIC NOT NULL DEFAULT 0,
  carbs_100g       NUMERIC NOT NULL DEFAULT 0,
  fat_100g         NUMERIC NOT NULL DEFAULT 0,
  fiber_100g       NUMERIC NOT NULL DEFAULT 0,
  size_label       TEXT,                        -- es. "medium", "slice, large"
  verified         BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_food_catalog_category ON food_catalog(usda_category);
CREATE INDEX idx_food_catalog_name ON food_catalog(lower(name) text_pattern_ops);

ALTER TABLE food_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read food_catalog" ON food_catalog;
CREATE POLICY "Users can read food_catalog" ON food_catalog
  FOR SELECT TO authenticated USING (true);