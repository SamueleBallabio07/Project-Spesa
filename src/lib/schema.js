/**
 * Definizione dello schema del database Supabase.
 * Ogni tabella e colonna deve corrispondere esattamente al database reale.
 */

export const TABLES = {
  PROFILES: 'profiles',
  SHOPPING_LISTS: 'shopping_lists',
  SHOPPING_ITEMS: 'shopping_items',
  SAVED_PRODUCTS: 'saved_products',
};

export const COLUMNS = {
  PROFILES: {
    ID: 'id',
    FULL_NAME: 'full_name',
    AVATAR_URL: 'avatar_url',
    CREATED_AT: 'created_at',
  },
  SHOPPING_LISTS: {
    ID: 'id',
    NAME: 'name',
    DESCRIPTION: 'description',
    OWNER_ID: 'owner_id',
    CREATED_AT: 'created_at',
  },
  SHOPPING_ITEMS: {
    ID: 'id',
    LIST_ID: 'list_id',
    NAME: 'name',
    QUANTITY: 'quantity',
    UNIT: 'unit',
    BOUGHT: 'bought',
    CATEGORY: 'category',
    NOTES: 'notes',
    CREATED_BY: 'created_by',
    CREATED_AT: 'created_at',
    KCAL100G: 'kcal100g',
    PROTEIN100G: 'protein100g',
    CARBS100G: 'carbs100g',
    FAT100G: 'fat100g',
    FIBER100G: 'fiber100g',
  },
  SAVED_PRODUCTS: {
    ID: 'id',
    USER_ID: 'user_id',
    NAME: 'name',
    QUANTITY: 'quantity',
    UNIT: 'unit',
    CATEGORY: 'category',
    NOTES: 'notes',
    CREATED_AT: 'created_at',
    KCAL100G: 'kcal100g',
    PROTEIN100G: 'protein100g',
    CARBS100G: 'carbs100g',
    FAT100G: 'fat100g',
    FIBER100G: 'fiber100g',
  },
};

export const UNIT_OPTIONS = ['pezzi', 'kg', 'g', 'l', 'ml', 'buste', 'scatole'];

export const CATEGORY_OPTIONS = [
  'Frutta e verdura',
  'Carne e pesce',
  'Latticini',
  'Pane e pasticceria',
  'Dispensa',
  'Surgelati',
  'Bevande',
  'Igiene e pulizia',
  'Altro',
];
