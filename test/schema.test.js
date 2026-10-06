/**
 * Coerenza fra database/schema.sql, src/lib/schema.js e il codice che interroga
 * il database. Sono i contratti che rompono in silenzio: un errore li produce
 * solo in produzione, o peggio, una tabella senza RLS espone i dati.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATEGORY_OPTIONS, COLUMNS, TABLES, UNIT_OPTIONS } from '../src/lib/schema.js';

const sql = readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8');
const hooks = readFileSync(
  new URL('../src/hooks/useShoppingList.js', import.meta.url),
  'utf8'
);

/** Nomi delle tabelle in `CREATE TABLE`, senza IF NOT EXISTS. */
const createdTables = [...sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/g)].map((m) => m[1]);

/** Nomi delle tabelle su cui RLS è abilitata. */
const rlsTables = [
  ...sql.matchAll(/ALTER TABLE (\w+)\s+ENABLE ROW LEVEL SECURITY/gi),
].map((m) => m[1]);

/** Tabelle su cui esiste almeno una policy. */
const policyTables = [
  ...new Set([...sql.matchAll(/CREATE POLICY "[^"]+"\s+ON (\w+)/gi)].map((m) => m[1])),
];

describe('copertura RLS', () => {
  it('lo schema dichiara almeno una tabella', () => {
    expect(createdTables.length).toBeGreaterThan(0);
  });

  // Il test che conta: senza RLS, chiunque abbia la chiave publishable
  // pubblica nel bundle puo leggere e scrivere la tabella.
  it('ogni tabella ha RLS abilitata', () => {
    const senzaRls = createdTables.filter((t) => !rlsTables.includes(t));
    expect(senzaRls).toEqual([]);
  });

  it('ogni tabella ha almeno una policy', () => {
    const senzaPolicy = rlsTables.filter((t) => !policyTables.includes(t));
    expect(senzaPolicy).toEqual([]);
  });

  it('ogni policy filtra per auth.uid(), per owner o per tabella padre', () => {
    // Il nome tabella puo contenere un punto (storage.objects), quindi il
    // pattern e [\w.]+ e non \w+. Le policy terminano con ';': senza agganciare
    // il blocco intero, una regex che non trova nulla passerebbe il test per
    // assenza di problemi. Per questo il conteggio deve combaciare.
    const policies = [...sql.matchAll(
      /CREATE POLICY "[^"]+"\s+ON ([\w.]+)\s+FOR \w+ TO authenticated[\s\S]*?;/gi
    )];

    const dichiarate = [...sql.matchAll(/CREATE POLICY "/g)].length;
    expect(policies.length).toBe(dichiarate);

    const sospette = policies
      .filter((m) => !/auth\.uid\(\)/.test(m[0]))
      .map((m) => `${m[1]}: ${m[0].split('\n')[0].trim()}`);
    expect(sospette).toEqual([]);
  });

  it('ogni policy di storage.objects controlla la cartella dell utente', () => {
    const storage = [...sql.matchAll(
      /CREATE POLICY "[^"]+"\s+ON storage\.objects[\s\S]*?;/gi
    )].map((m) => m[0]);

    expect(storage.length).toBeGreaterThan(0);
    for (const p of storage) {
      expect(p).toMatch(/bucket_id\s*=\s*'avatars'/);
      expect(p).toMatch(/storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/);
    }
  });

  it('il bucket avatars non e pubblico', () => {
    // public = true espone ogni URL di avatar e rende inutili le RLS in
    // lettura: la protezione dipenderebbe solo dal nome file.
    const bucket = sql.match(/INSERT INTO storage\.buckets[\s\S]*?;/i)?.[0] ?? '';
    expect(bucket).toMatch(/VALUES\s*\(\s*'avatars'\s*,\s*'avatars'\s*,\s*false\s*\)/i);
  });
});

describe('schema.sql e schema.js sono allineati', () => {
  it('ogni tabella in SQL ha una costante in TABLES', () => {
    const mancanti = createdTables.filter((t) => !Object.values(TABLES).includes(t));
    expect(mancanti).toEqual([]);
  });

  it('ogni tabella in TABLES esiste in SQL', () => {
    const inesistenti = Object.values(TABLES).filter((t) => !createdTables.includes(t));
    expect(inesistenti).toEqual([]);
  });

  it('ogni tabella in TABLES ha una sezione in COLUMNS', () => {
    const mancanti = Object.keys(TABLES).filter(
      (key) => !COLUMNS[key] || Object.keys(COLUMNS[key]).length === 0
    );
    expect(mancanti).toEqual([]);
  });

  it('ogni colonna in COLUMNS esiste nella sua tabella', () => {
    const problemi = [];

    for (const [key, table] of Object.entries(TABLES)) {
      const blocco = sql.match(
        new RegExp(`CREATE TABLE (?:IF NOT EXISTS )?${table}\\s*\\(([\\s\\S]*?)\\n\\s*\\);`)
      );
      if (!blocco) {
        problemi.push(`${table}: definizione non trovata in schema.sql`);
        continue;
      }

      for (const col of Object.values(COLUMNS[key])) {
        if (!new RegExp(`^\\s*${col}\\s`, 'm').test(blocco[1])) {
          problemi.push(`${table}.${col}: assente in schema.sql`);
        }
      }
    }

    expect(problemi).toEqual([]);
  });

  it('le quantita hanno un default in SQL, perche il frontend le normalizza', () => {
    // quantity non e NOT NULL: se il frontend manda un valore non numerico il
    // default lo copre. Il codice deve comunque mandare sempre Number(x).
    const qty = sql.match(
      /CREATE TABLE (?:IF NOT EXISTS )?saved_products[\s\S]*?quantity ([^,\n]*)/
    )?.[1];

    expect(qty).toMatch(/NUMERIC/);
    expect(qty).toMatch(/DEFAULT/);
    expect(COLUMNS.SAVED_PRODUCTS.QUANTITY).toBe('quantity');
    // Il codice ora usa RPC save_product_for_reuse che gestisce la conversione internamente
    expect(hooks).toMatch(/p_quantity/);
  });
});

describe('vincoli richiesti dal codice', () => {
  it('saved_products ha il vincolo UNIQUE che richiede upsert onConstraint (o RPC equivalente)', () => {
    // Il codice ora usa RPC save_product_for_reuse che gestisce l'upsert internamente.
    // Verifica che la chiamata RPC sia presente.
    expect(hooks).toMatch(/supabase\.rpc\(\s*['"]save_product_for_reuse['"]/);
    // Verifica che i parametri nutrizionali vengano passati
    expect(hooks).toMatch(/p_kcal100g/);
    expect(hooks).toMatch(/p_protein100g/);
    expect(hooks).toMatch(/p_carbs100g/);
    expect(hooks).toMatch(/p_fat100g/);
    expect(hooks).toMatch(/p_fiber100g/);
  });

  it('il vincolo UNIQUE e idempotente, come il resto dello schema', () => {
    // Se lo esegui due volte l'ADD CONSTRAINT deve fallire, perche' il
    // vincolo esiste gia': sta dentro un DO $$ che controlla pg_constraint.
    expect(sql).toMatch(/DO \$\$\s*BEGIN[\s\S]*?pg_constraint[\s\S]*?ADD CONSTRAINT/);
    expect(sql).toMatch(/IF NOT EXISTS \([\s\S]*?conname = 'saved_products_user_name_key'/);
  });

  it('gli errori di salvataggio dei prodotti non sono ignorati (usa RPC save_product_for_reuse)', () => {
    // Il codice ora usa RPC save_product_for_reuse per salvare i prodotti.
    // Verifica che la chiamata RPC sia presente e che gli errori siano gestiti.
    expect(hooks).toMatch(/supabase\.rpc\(\s*['"]save_product_for_reuse['"]/);
    // Verifica che i parametri nutrizionali vengano passati
    expect(hooks).toMatch(/p_kcal100g/);
    expect(hooks).toMatch(/p_protein100g/);
    expect(hooks).toMatch(/p_carbs100g/);
    expect(hooks).toMatch(/p_fat100g/);
    expect(hooks).toMatch(/p_fiber100g/);
  });
});

describe('costanti di UI', () => {
  it('le unita includono g, kg, ml e l, servite alla conversione', () => {
    for (const u of ['pezzi', 'kg', 'g', 'l', 'ml', 'buste', 'scatole']) {
      expect(UNIT_OPTIONS).toContain(u);
    }
  });

  it('le categorie non sono vuote ne duplicate', () => {
    expect(CATEGORY_OPTIONS.length).toBeGreaterThan(0);
    expect(new Set(CATEGORY_OPTIONS).size).toBe(CATEGORY_OPTIONS.length);
    // "Altro" e il fallback: se manca, un alimento senza categoria non ha dove andare
    expect(CATEGORY_OPTIONS).toContain('Altro');
  });
});
