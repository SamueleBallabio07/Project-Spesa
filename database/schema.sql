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
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Prodotti salvati (per riaggiungere velocemente)
-- Il vincolo UNIQUE (user_id, name) sta in un ALTER TABLE separato, non dentro
-- la CREATE TABLE: con IF NOT EXISTS la tabella viene saltata se esiste gia'
-- e un vincolo dichiarato li dentro non arriverebbe mai al database.
-- L'app usa upsert con onConstraint su questa coppia: senza il vincolo ogni
-- salvataggio fallisce. Vedi anche database/fix-unique.sql.
CREATE TABLE IF NOT EXISTS saved_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity NUMERIC DEFAULT 1,
  unit TEXT DEFAULT 'pezzi',
  category TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
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

-- Membri della lista (condivisione)
CREATE TABLE IF NOT EXISTS list_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'viewer',
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(list_id, user_id)
);

-- Inviti alla lista
CREATE TABLE IF NOT EXISTS list_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Storico modifiche prodotti
CREATE TABLE IF NOT EXISTS shopping_items_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID REFERENCES shopping_items(id) ON DELETE SET NULL,
  changed_by UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDICI
-- ============================================

CREATE INDEX IF NOT EXISTS idx_shopping_lists_owner ON shopping_lists(owner_id);
CREATE INDEX IF NOT EXISTS idx_shopping_items_list ON shopping_items(list_id);
CREATE INDEX IF NOT EXISTS idx_shopping_items_bought ON shopping_items(bought);
CREATE INDEX IF NOT EXISTS idx_list_memberships_list ON list_memberships(list_id);
CREATE INDEX IF NOT EXISTS idx_list_memberships_user ON list_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_list_invitations_list ON list_invitations(list_id);
CREATE INDEX IF NOT EXISTS idx_shopping_items_history_item ON shopping_items_history(item_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_items_history ENABLE ROW LEVEL SECURITY;

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

-- Policies per list_memberships
DROP POLICY IF EXISTS "Users can read memberships" ON list_memberships;
CREATE POLICY "Users can read memberships" ON list_memberships
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- INSERT: controlla sia il proprio user_id sia la proprieta' della lista.
-- Con il solo user_id = auth.uid() un utente qualsiasi poteva iscriversi a una
-- lista altrui inserendo una riga con il proprio id e il list_id della vittima.
DROP POLICY IF EXISTS "Users can insert memberships" ON list_memberships;
CREATE POLICY "Users can insert memberships" ON list_memberships
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() AND
    list_id IN (SELECT id FROM shopping_lists WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete memberships" ON list_memberships;
CREATE POLICY "Users can delete memberships" ON list_memberships
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Policies per list_invitations
DROP POLICY IF EXISTS "Users can read invitations" ON list_invitations;
CREATE POLICY "Users can read invitations" ON list_invitations
  FOR SELECT TO authenticated USING (
    invited_by = auth.uid() OR
    list_id IN (SELECT id FROM shopping_lists WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert invitations" ON list_invitations;
CREATE POLICY "Users can insert invitations" ON list_invitations
  FOR INSERT TO authenticated WITH CHECK (
    invited_by = auth.uid()
  );

DROP POLICY IF EXISTS "Users can update invitations" ON list_invitations;
CREATE POLICY "Users can update invitations" ON list_invitations
  FOR UPDATE TO authenticated USING (
    invited_by = auth.uid()
  );

-- Policies per shopping_items_history
DROP POLICY IF EXISTS "Users can read history" ON shopping_items_history;
CREATE POLICY "Users can read history" ON shopping_items_history
  FOR SELECT TO authenticated USING (
    item_id IN (SELECT id FROM shopping_items WHERE list_id IN (SELECT id FROM shopping_lists WHERE owner_id = auth.uid()))
  );

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

DROP TRIGGER IF EXISTS set_created_at ON list_memberships;
CREATE TRIGGER set_created_at
  BEFORE INSERT ON list_memberships
  FOR EACH ROW EXECUTE FUNCTION update_created_at();

DROP TRIGGER IF EXISTS set_created_at ON list_invitations;
CREATE TRIGGER set_created_at
  BEFORE INSERT ON list_invitations
  FOR EACH ROW EXECUTE FUNCTION update_created_at();

DROP TRIGGER IF EXISTS set_created_at ON shopping_items_history;
CREATE TRIGGER set_created_at
  BEFORE INSERT ON shopping_items_history
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
-- MESSAGGIO FINALE
-- ============================================

SELECT 'Database schema creato con successo!' AS message;
