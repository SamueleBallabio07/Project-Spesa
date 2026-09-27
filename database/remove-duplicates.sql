-- Elimina i prodotti duplicati mantenendo solo il più recente per ogni nome (case-insensitive) per ogni lista
-- Esegui questo in Supabase SQL Editor

DELETE FROM shopping_items
WHERE id NOT IN (
  SELECT DISTINCT ON (lower(name), list_id) id
  FROM shopping_items
  ORDER BY lower(name), list_id, created_at DESC
);

-- Verifica i duplicati rimasti (dovrebbe essere vuoto)
SELECT lower(name) as name_lower, list_id, COUNT(*) as count
FROM shopping_items
GROUP BY lower(name), list_id
HAVING COUNT(*) > 1;
