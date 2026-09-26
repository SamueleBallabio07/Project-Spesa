# Lista della Spesa

App privata per gestire la lista della spesa, costruita con React + Vite + Supabase.

## Avvio

```bash
npm install
npm run dev
```

## Configura

Crea un file `.env` nella root con:

```
VITE_SUPABASE_URL=https://tuo-progetto.supabase.co
VITE_SUPABASE_ANON_KEY=tua-anon-key
```

## Struttura

```
src/
  components/
    Auth.jsx          → login/registrazione
    ShoppingList.jsx  → lista della spesa
  hooks/
    useAuth.js        → logica autenticazione
    useShoppingList.js → logica liste e prodotti
  lib/
    supabase.js       → client Supabase
    schema.js         → definizione tabelle e colonne
  App.jsx             → orchestrazione
```

## Schema Database

| Tabella | Colonne |
|---------|---------|
| `profiles` | id, full_name, avatar_url, created_at |
| `shopping_lists` | id, name, description, owner_id, created_at |
| `shopping_items` | id, list_id, name, quantity, unit, bought, category, notes, created_by, created_at |
| `list_memberships` | id, list_id, user_id, role, joined_at |
| `list_invitations` | id, list_id, email, invited_by, status, created_at |
| `shopping_items_history` | id, item_id, changed_by, action, old_value, new_value, created_at |

## Funzionalità

- Login/registrazione con email e password
- Creazione di multiple liste della spesa
- Aggiunta prodotti con quantità, unità, categoria e note
- Spunta prodotti acquistati
- Eliminazione prodotti
- Conteggio totale/comprati/in attesa
