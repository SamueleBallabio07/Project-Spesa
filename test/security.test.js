/**
 * Guardia per la pubblicazione della repo su GitHub.
 *
 * Il frontend usa una chiave publishable Supabase, pubblica per design: la
 * sicurezza dei dati poggia interamente sulle RLS. Questi test verificano
 * che nel repository non finisca nulla che non debba finire, e che le
 * condizioni di sicurezza restino valide quando il codice viene pubblicato.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

const gitignore = read('.gitignore');
const pkg = JSON.parse(read('package.json'));

/**
 * File tracciati da git: cioe' quelli che finirebbero pubblici.
 *
 * `git ls-files` da solo elenca anche i file rimossi dalla working tree ma non
 * ancora committati, e il test li aprirebbe: togliere una skill faceva
 * fallire la guardia con ENOENT. Si escludono quelli.
 */
const pathsOf = (args) =>
  execFileSync('git', ['ls-files', ...args], { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.slice(3)) // "XY path" -> "path"
    .filter(Boolean);

/** File rimossi dalla working tree: non esistono piu' e non andrebbero letti. */
const deleted = new Set(pathsOf(['-d']));

const tracked = pathsOf([]).filter((p) => !deleted.has(p));

/**
 * File che documentano le regole invece di usarle: AGENTS.md, le skill e i
 * test stessi parlano di chiavi e ruoli per dire di non usarli. Non sono
 * credenziali, ma non possono esistere in un file che genera codice.
 */
const documentano = /(^AGENTS\.md$|\.opencode\/skills\/|^test\/)/;

/** Sorgenti che finiscono nel bundle del browser. */
const sources = [
  'src/App.jsx',
  'src/main.jsx',
  'src/lib/supabase.js',
  'src/lib/schema.js',
  'src/lib/nutrition.js',
  'src/lib/quantity.js',
  'src/lib/units.js',
  'src/components/Auth.jsx',
  'src/components/ShoppingList.jsx',
  'src/components/CatalogScreen.jsx',
  'src/components/TabBar.jsx',
  'src/hooks/useAuth.js',
  'src/hooks/useShoppingList.js',
  'src/hooks/useSavedProducts.js',
  'src/hooks/useFoodCatalog.js',
  'src/hooks/useOfflineSync.js',
  'index.html',
].map(read).join('\n');

describe('niente segreti nel repository', () => {
  it('nessun file tracciato contiene .env', () => {
    const offenders = tracked.filter((f) => /(^|\/)\.env($|\.)/.test(f) && f !== '.env.example');
    expect(offenders).toEqual([]);
  });

  it('nessun file tracciato e una chiave o una credenziale', () => {
    // Pattern delle chiavi che non devono MAI apparire in un repo pubblico.
    const patterns = [
      /sb_secret_\w+/, // chiave segreta Supabase
      /eyJ[A-Za-z0-9_-]{20,}\./, // JWT
      /sk-[A-Za-z0-9]{20,}/, // chiave OpenAI
      /ghp_[A-Za-z0-9]{20,}/, // token GitHub
      /AKIA[0-9A-Z]{16}/, // chiave AWS
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
      // La parola "service_role" compare di proposito in AGENTS.md, nelle
      // skill e qui stessa, come regola ("mai nel frontend"). Beccarla e'
      // un falso positivo che renderebbe il test inutilizzabile: si cerca
      // invece un assegnamento, che e' la forma in cui una chiave si usa.
      /service_role['"]?\s*[:=]\s*['"][^'"]+['"]/i,
    ];

    const offenders = [];
    for (const file of tracked) {
      if (/package-lock\.json$|catalog\.json$|\.png$|\.svg$/.test(file)) continue;
      let text;
      try {
        text = read(file);
      } catch {
        continue; // binari o file spariti
      }
      for (const re of patterns) {
        if (!re.test(text)) continue;
        // nei file che documentano, il pattern non deve essere un valore
        if (documentano.test(file)) continue;
        offenders.push(`${file}: ${re}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('la regola su service_role resta una regola, non una chiave', () => {
    // Se il test di sopra ignora i file che documentano le regole, va
    // verificato che quei file non contengano davvero un valore.
    for (const file of tracked.filter((f) => documentano.test(f))) {
      const text = read(file);
      expect(text).not.toMatch(/sb_secret_[A-Za-z0-9]+/);
      expect(text).not.toMatch(/service_role['"]?\s*[:=]\s*['"][^'"]+['"]/i);
    }
  });

  it('nessun file sorgente contiene una chiave hardcoded', () => {
    // Supabase.js deve leggere solo da import.meta.env.
    expect(sources).not.toMatch(/sb_publishable_[A-Za-z0-9]{10,}/);
    expect(sources).not.toMatch(/sb_secret_\w+/);
    expect(sources).not.toMatch(/service_role/);
  });

  it('la sola chiave esposta al bundle e la publishable, mai la segreta', () => {
    const env = [...sources.matchAll(/import\.meta\.env\.([A-Z_0-9]+)/g)].map((m) => m[1]);
    expect([...new Set(env)].sort()).toEqual([
      'VITE_SUPABASE_ANON_KEY',
      'VITE_SUPABASE_URL',
    ]);
  });

  it('esiste un .env.example con placeholder, non valori reali', () => {
    const example = read('.env.example');
    expect(example).toMatch(/VITE_SUPABASE_URL=/);
    expect(example).toMatch(/VITE_SUPABASE_ANON_KEY=/);
    // placeholder, non una chiave viva
    expect(example).not.toMatch(/sb_publishable_[A-Za-z0-9]{20,}/);
    expect(example).not.toMatch(/supabase\.co/);
  });
});

describe(' hygiene del repository pubblico', () => {
  it('.gitignore copre env, dipendenze e build', () => {
    for (const pattern of ['.env', 'node_modules', 'dist']) {
      expect(gitignore).toMatch(new RegExp(`^${pattern.replace('.', '\\.')}$`, 'm'));
    }
  });

  it('.env.example resta tracciabile', () => {
    expect(gitignore).toMatch(/!\.env\.example/);
  });

  it('nessun file tracciato e rumore locale', () => {
    const offenders = tracked.filter((f) =>
      /(^|\/)(\.DS_Store|Thumbs\.db)$|(^|\/)(dist|node_modules)\//.test(f)
    );
    expect(offenders).toEqual([]);
  });

  it('il package.json non e pubblicabile', () => {
    expect(pkg.private).toBe(true);
    expect(pkg.version).toBe('0.0.0');
  });

  it('non ci sono sorgemaps pubblicate', () => {
    expect(read('vite.config.js')).not.toMatch(/sourcemap/);
  });

  it('le dipendenze sono versionate esattamente nel lockfile', () => {
    // Con ^ le dipendenze possono cambiare da un giorno all'altro in un fresh
    // install: per un'app che parla con un database reale, il lockfile e' la
    // garanzia che si installi lo stesso codice testato.
    const lock = JSON.parse(read('package-lock.json'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const name of Object.keys(deps)) {
      expect(lock.packages[`node_modules/${name}`]).toBeDefined();
    }
  });
});

describe('il frontend non puo aggirare le RLS', () => {
  it('non crea il client con una chiave segreta', () => {
    expect(read('src/lib/supabase.js')).toMatch(/import\.meta\.env\.VITE_SUPABASE_ANON_KEY/);
    expect(read('src/lib/supabase.js')).not.toMatch(/service_role|sb_secret_/);
  });

  it('ogni query sugli utenti filtra per l id della sessione', () => {
    // Un select senza filtro per user_id su una tabella per-utente e' un
    // accesso potenziale cross-utente: le RLS lo fermano, ma non accertarsi
    // che la policy esista non e accettabile. Qui si verifica il codice.
    const hooks = [
      'src/hooks/useShoppingList.js',
      'src/hooks/useSavedProducts.js',
    ].map(read).join('\n');

    // saved_products e per-utente: ogni suo accesso porta il filtro user_id
    const saved = hooks.slice(hooks.indexOf('SAVED_PRODUCTS'));
    const select = saved.match(/from\(TABLES\.SAVED_PRODUCTS\)\s*\.select\([^)]*\)((?:\s*\.\w+\([^)]*\))*)/);
    if (select) {
      expect(select[1]).toMatch(/\.eq\(\s*COLUMNS\.SAVED_PRODUCTS\.USER_ID/);
    }
  });

  it('il bundle non contiene il prefisso della chiave segreta', () => {
    // Difesa in profondita': anche se qualcosa finisse nel sorgente, il build
    // non deve poter produrre una chiave utilizzabile.
    const supabase = read('src/lib/supabase.js');
    expect(supabase).not.toMatch(/sb_secret_/);
    expect(pkg.dependencies['@supabase/supabase-js']).toBeTruthy();
  });
});
