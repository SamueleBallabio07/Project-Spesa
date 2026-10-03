-- ============================================
-- RPC FUNCTIONS per operazioni complesse
-- Eseguire in Supabase SQL Editor DOPO schema.sql
-- ============================================

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

SELECT 'RPC functions create con successo!' AS message;