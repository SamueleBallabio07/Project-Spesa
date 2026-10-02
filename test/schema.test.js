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

  it('le policy di iscrizione controllano anche la proprieta della lista', () => {
    // WITH CHECK (user_id = auth.uid()) da solo permette di iscriversi a una
    // lista altrui: basta mandare il proprio id con il list_id della vittima.
    const insert = sql.match(
      /CREATE POLICY "Users can insert memberships"[\s\S]*?;/i
    )?.[0];

    expect(insert).toMatch(/user_id\s*=\s*auth\.uid\(\)/);
    expect(insert).toMatch(/list_id\s+IN\s*\(\s*SELECT\s+id\s+FROM\s+shopping_lists\s+WHERE\s+owner_id\s*=\s*auth\.uid\(\)\s*\)/);
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
    expect(hooks).toMatch(/\[\s*COLUMNS\.SAVED_PRODUCTS\.QUANTITY\s*\]:\s*Number\(quantity\)/);
  });
});

describe('vincoli richiesti dal codice', () => {
  it('saved_products ha il vincolo UNIQUE che richiede upsert onConstraint', () => {
    // useShoppingList.js fa upsert con onConstraint costruito da
    // COLUMNS.SAVED_PRODUCTS.USER_ID e .NAME. Il template literal e spezzato
    // sulle righe, quindi il test aggancia le costanti usate, non la forma.
    expect(hooks).toMatch(
      /onConstraint:\s*`\$\{COLUMNS\.SAVED_PRODUCTS\.USER_ID\},\$\{COLUMNS\.SAVED_PRODUCTS\.NAME\}`/
    );

    // Il vincolo NON puo' stare dentro CREATE TABLE IF NOT EXISTS: se la
    // tabella esiste gia' l'intera CREATE TABLE viene saltata e il vincolo
    // non arriva mai al database. Deve essere un ALTER TABLE, quindi qui si
    // cerca in tutto il file e non solo nel corpo della CREATE TABLE.
    const dentroCreate = sql.match(
      /CREATE TABLE (?:IF NOT EXISTS )?saved_products\s*\(([\s\S]*?)\n\s*\);/
    )?.[1] ?? '';
    expect(dentroCreate).not.toMatch(/UNIQUE\s*\(\s*user_id\s*,\s*name\s*\)/);

    const alterTable = sql.match(
      /ALTER TABLE saved_products\s+ADD CONSTRAINT[\s\S]*?UNIQUE\s*\(\s*user_id\s*,\s*name\s*\)/
    );
    expect(alterTable?.[0]).toBeTruthy();
  });

  it('il vincolo UNIQUE e idempotente, come il resto dello schema', () => {
    // Se lo esegui due volte l'ADD CONSTRAINT deve fallire, perche' il
    // vincolo esiste gia': sta dentro un DO $$ che controlla pg_constraint.
    expect(sql).toMatch(/DO \$\$\s*BEGIN[\s\S]*?pg_constraint[\s\S]*?ADD CONSTRAINT/);
    expect(sql).toMatch(/IF NOT EXISTS \([\s\S]*?conname = 'saved_products_user_name_key'/);
  });

  it('gli errori di salvataggio dei prodotti non sono ignorati', () => {
    // Il blocco va dalla destrutturazione della risposta al primo setError:
    // e li che l'errore va gestito, e subito dopo il salvataggio avviene.
    // 'const' davanti: la destrutturazione inizia subito prima della chiamata.
    const inizio = hooks.indexOf('await supabase.from(TABLES.SAVED_PRODUCTS)');
    expect(inizio).toBeGreaterThan(-1);

    const blocco = hooks.slice(hooks.lastIndexOf('const', inizio));
    const fine = blocco.indexOf('setError');
    const segmento = fine === -1 ? blocco : blocco.slice(0, fine);

    expect(segmento).toMatch(/const\s*\{\s*(?:error|saveError)\s*:[^}]*\}\s*=\s*await/);
    expect(segmento).toMatch(/if\s*\(\s*(?:error|saveError)\s*\)\s*\{[\s\S]*?console\.error/);
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
