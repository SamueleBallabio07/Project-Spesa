-- ============================================
-- LISTA DELLA SPESA - Database Schema
-- Importa questo file in Supabase SQL Editor
-- ============================================

-- Estensione per UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABELLE PRINCIPALI
-- ============================================

-- Profili utenti (solo ciò che serve, niente email duplicata)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT 'Utente',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Liste della spesa
CREATE TABLE IF NOT EXISTS shopping_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Prodotti nella lista
CREATE TABLE IF NOT EXISTS shopping_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity NUMERIC DEFAULT 1,
  unit TEXT DEFAULT 'pezzi',
  bought BOOLEAN DEFAULT false,
  category TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  kcal100g NUMERIC,
  protein100g NUMERIC,
  carbs100g NUMERIC,
  fat100g NUMERIC,
  fiber100g NUMERIC
);

-- Prodotti salvati (per riaggiungere velocemente)
-- Il vincolo UNIQUE (user_id, name) sta in un ALTER TABLE separato, non dentro
-- la CREATE TABLE: con IF NOT EXISTS la tabella viene saltata se esiste gia'
-- e un vincolo dichiarato li dentro non arriverebbe mai al database.
-- Il blocco DO $$ qui sotto applica il vincolo anche su una tabella gia'
-- esistente, quindi non serve un file di riparazione separato.
CREATE TABLE IF NOT EXISTS saved_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity NUMERIC DEFAULT 1,
  unit TEXT DEFAULT 'pezzi',
  category TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  kcal100g NUMERIC,
  protein100g NUMERIC,
  carbs100g NUMERIC,
  fat100g NUMERIC,
  fiber100g NUMERIC
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'saved_products'::regclass
      AND conname = 'saved_products_user_name_key'
  ) THEN
    ALTER TABLE saved_products
      ADD CONSTRAINT saved_products_user_name_key UNIQUE (user_id, name);
  END IF;
END $$;

-- ============================================
-- INDICI
-- ============================================

CREATE INDEX IF NOT EXISTS idx_shopping_lists_owner ON shopping_lists(owner_id);
CREATE INDEX IF NOT EXISTS idx_shopping_items_list ON shopping_items(list_id);
CREATE INDEX IF NOT EXISTS idx_shopping_items_bought ON shopping_items(bought);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_products ENABLE ROW LEVEL SECURITY;

-- Policies per profiles
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

-- Policies per shopping_lists
DROP POLICY IF EXISTS "Users can create lists" ON shopping_lists;
CREATE POLICY "Users can create lists" ON shopping_lists
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can read own lists" ON shopping_lists;
CREATE POLICY "Users can read own lists" ON shopping_lists
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update own lists" ON shopping_lists;
CREATE POLICY "Users can update own lists" ON shopping_lists
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can delete own lists" ON shopping_lists;
CREATE POLICY "Users can delete own lists" ON shopping_lists
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- Policies per shopping_items
DROP POLICY IF EXISTS "Users can read items in own lists" ON shopping_items;
CREATE POLICY "Users can read items in own lists" ON shopping_items
  FOR SELECT TO authenticated USING (
    list_id IN (SELECT id FROM shopping_lists WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert items in own lists" ON shopping_items;
CREATE POLICY "Users can insert items in own lists" ON shopping_items
  FOR INSERT TO authenticated WITH CHECK (
    list_id IN (SELECT id FROM shopping_lists WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update items in own lists" ON shopping_items;
CREATE POLICY "Users can update items in own lists" ON shopping_items
  FOR UPDATE TO authenticated USING (
    list_id IN (SELECT id FROM shopping_lists WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete items in own lists" ON shopping_items;
CREATE POLICY "Users can delete items in own lists" ON shopping_items
  FOR DELETE TO authenticated USING (
    list_id IN (SELECT id FROM shopping_lists WHERE owner_id = auth.uid())
  );

-- Policies per saved_products
-- La tabella esisteva senza RLS: con la chiave publishable pubblica nel bundle
-- chiunque poteva leggere e scrivere i prodotti salvati di tutti gli utenti.
DROP POLICY IF EXISTS "Users can read own saved products" ON saved_products;
CREATE POLICY "Users can read own saved products" ON saved_products
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own saved products" ON saved_products;
CREATE POLICY "Users can insert own saved products" ON saved_products
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own saved products" ON saved_products;
CREATE POLICY "Users can update own saved products" ON saved_products
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own saved products" ON saved_products;
CREATE POLICY "Users can delete own saved products" ON saved_products
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================
-- TRIGGER per aggiornare created_at
-- ============================================

CREATE OR REPLACE FUNCTION update_created_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_created_at ON profiles;
CREATE TRIGGER set_created_at
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_created_at();

DROP TRIGGER IF EXISTS set_created_at ON shopping_lists;
CREATE TRIGGER set_created_at
  BEFORE INSERT ON shopping_lists
  FOR EACH ROW EXECUTE FUNCTION update_created_at();

DROP TRIGGER IF EXISTS set_created_at ON shopping_items;
CREATE TRIGGER set_created_at
  BEFORE INSERT ON shopping_items
  FOR EACH ROW EXECUTE FUNCTION update_created_at();

-- ============================================
-- STORAGE per avatar
-- ============================================

-- public = false: con public = true le RLS non proteggono la lettura e
-- ogni URL di avatar sarebbe pubblico. Da privato si puo' tornare pubblico,
-- il contrario richiede di ripubblicare i file.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Users can upload avatars" ON storage.objects;
CREATE POLICY "Users can upload avatars" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Un avatar per utente: la cartella deve essere la propria.
DROP POLICY IF EXISTS "Users can read avatars" ON storage.objects;
CREATE POLICY "Users can read avatars" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update avatars" ON storage.objects;
CREATE POLICY "Users can update avatars" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete avatars" ON storage.objects;
CREATE POLICY "Users can delete avatars" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================
-- RPC FUNCTIONS per operazioni complesse
-- ============================================

-- RPC: add_or_update_item
-- Gestisce in un'unica query atomica:
-- 1. Se esiste nella stessa lista -> incrementa quantità
-- 2. Se esiste in altra lista -> duplica con valori nutrizionali
-- 3. Altrimenti -> crea nuovo
-- Ritorna: { item_id, action: 'updated' | 'duplicated' | 'created' }
-- ============================================

CREATE OR REPLACE FUNCTION add_or_update_item(
  p_list_id UUID,
  p_name TEXT,
  p_quantity NUMERIC,
  p_unit TEXT,
  p_category TEXT,
  p_notes TEXT,
  p_user_id UUID,
  p_kcal100g NUMERIC,
  p_protein100g NUMERIC,
  p_carbs100g NUMERIC,
  p_fat100g NUMERIC,
  p_fiber100g NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_name TEXT := trim(p_name);
  v_normalized_name TEXT := lower(trim(p_name));
  v_user_list_ids UUID[];
  v_same_list_item shopping_items%ROWTYPE;
  v_existing_product shopping_items%ROWTYPE;
  v_new_item shopping_items%ROWTYPE;
  v_action TEXT;
BEGIN
  -- Validazione
  IF v_clean_name = '' OR p_list_id IS NULL OR p_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Parametri mancanti');
  END IF;

  -- Verifica che la lista appartenga all'utente
  IF NOT EXISTS (
    SELECT 1 FROM shopping_lists 
    WHERE id = p_list_id AND owner_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('error', 'Lista non trovata o non autorizzata');
  END IF;

  -- Ottieni tutte le liste dell'utente
  SELECT array_agg(id) INTO v_user_list_ids
  FROM shopping_lists
  WHERE owner_id = p_user_id;

  -- 1. Cerca nella STESSA lista (priorità: aggiorna quantità)
  SELECT * INTO v_same_list_item
  FROM shopping_items
  WHERE list_id = p_list_id
    AND lower(name) = v_normalized_name
  LIMIT 1;

  IF FOUND THEN
    -- Aggiorna quantità
    UPDATE shopping_items
    SET quantity = quantity + COALESCE(p_quantity, 1)
    WHERE id = v_same_list_item.id
    RETURNING * INTO v_new_item;

    RETURN jsonb_build_object(
      'item_id', v_new_item.id,
      'action', 'updated',
      'quantity', v_new_item.quantity
    );
  END IF;

  -- 2. Cerca in ALTRE liste dell'utente (duplica con valori nutrizionali)
  SELECT * INTO v_existing_product
  FROM shopping_items
  WHERE list_id IN (SELECT unnest(v_user_list_ids))
    AND list_id != p_list_id
    AND lower(name) = v_normalized_name
  LIMIT 1;

  IF FOUND THEN
    -- Duplica copiando valori nutrizionali
    INSERT INTO shopping_items (
      list_id, name, quantity, unit, bought, category, notes,
      kcal100g, protein100g, carbs100g, fat100g, fiber100g,
      created_by
    ) VALUES (
      p_list_id,
      v_existing_product.name,
      COALESCE(p_quantity, 1),
      v_existing_product.unit,
      false,
      v_existing_product.category,
      v_existing_product.notes,
      v_existing_product.kcal100g,
      v_existing_product.protein100g,
      v_existing_product.carbs100g,
      v_existing_product.fat100g,
      v_existing_product.fiber100g,
      p_user_id
    )
    RETURNING * INTO v_new_item;

    RETURN jsonb_build_object(
      'item_id', v_new_item.id,
      'action', 'duplicated',
      'quantity', v_new_item.quantity
    );
  END IF;

  -- 3. Nuovo prodotto
  INSERT INTO shopping_items (
    list_id, name, quantity, unit, bought, category, notes,
    kcal100g, protein100g, carbs100g, fat100g, fiber100g,
    created_by
  ) VALUES (
    p_list_id,
    v_clean_name,
    COALESCE(p_quantity, 1),
    COALESCE(p_unit, 'pezzi'),
    false,
    p_category,
    p_notes,
    p_kcal100g,
    p_protein100g,
    p_carbs100g,
    p_fat100g,
    p_fiber100g,
    p_user_id
  )
  RETURNING * INTO v_new_item;

  RETURN jsonb_build_object(
    'item_id', v_new_item.id,
    'action', 'created',
    'quantity', v_new_item.quantity
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- ============================================
-- RPC: save_product_for_reuse
-- Salva/aggiorna prodotto in saved_products con valori nutrizionali
-- ============================================

CREATE OR REPLACE FUNCTION save_product_for_reuse(
  p_user_id UUID,
  p_name TEXT,
  p_quantity NUMERIC,
  p_unit TEXT,
  p_category TEXT,
  p_notes TEXT,
  p_kcal100g NUMERIC,
  p_protein100g NUMERIC,
  p_carbs100g NUMERIC,
  p_fat100g NUMERIC,
  p_fiber100g NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_name TEXT := trim(p_name);
  v_result saved_products%ROWTYPE;
BEGIN
  IF v_clean_name = '' OR p_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Parametri mancanti');
  END IF;

  INSERT INTO saved_products (
    user_id, name, quantity, unit, category, notes,
    kcal100g, protein100g, carbs100g, fat100g, fiber100g
  ) VALUES (
    p_user_id,
    v_clean_name,
    COALESCE(p_quantity, 1),
    COALESCE(p_unit, 'pezzi'),
    p_category,
    p_notes,
    p_kcal100g,
    p_protein100g,
    p_carbs100g,
    p_fat100g,
    p_fiber100g
  )
  ON CONFLICT (user_id, name) DO UPDATE SET
    quantity = EXCLUDED.quantity,
    unit = EXCLUDED.unit,
    category = EXCLUDED.category,
    notes = EXCLUDED.notes,
    kcal100g = EXCLUDED.kcal100g,
    protein100g = EXCLUDED.protein100g,
    carbs100g = EXCLUDED.carbs100g,
    fat100g = EXCLUDED.fat100g,
    fiber100g = EXCLUDED.fiber100g
  RETURNING * INTO v_result;

  RETURN jsonb_build_object(
    'id', v_result.id,
    'saved', true
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- ============================================
-- GRANT per le funzioni
-- ============================================

GRANT EXECUTE ON FUNCTION add_or_update_item TO authenticated;
GRANT EXECUTE ON FUNCTION save_product_for_reuse TO authenticated;

-- ============================================
-- MESSAGGIO FINALE
-- ============================================

SELECT 'Schema e RPC functions create con successo!' AS message;
