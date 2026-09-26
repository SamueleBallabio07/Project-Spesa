import { useState } from 'react';

function formatAuthError(error) {
  const message = error?.message || 'Si è verificato un errore.';
  const lower = message.toLowerCase();

  if (lower.includes('load failed') || lower.includes('failed to fetch') || lower.includes('network') || lower.includes('fetch')) {
    return 'Supabase non è raggiungibile. Controlla VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.';
  }
  if (lower.includes('signups are disabled') || lower.includes('sign up is disabled') || lower.includes('email signups are disabled')) {
    return 'La registrazione email è disattivata in Supabase. Apri Authentication > Providers > Email e abilitala.';
  }
  if (lower.includes('invalid login credentials')) {
    return 'Credenziali non valide. Controlla email e password.';
  }
  if (lower.includes('user already registered')) {
    return 'Questa email è già registrata. Prova ad accedere.';
  }
  return message;
}

export default function Auth({ hasSupabaseConfig, onSignIn, onSignUp }) {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Inserisci email e password.');
      return;
    }
    if (!hasSupabaseConfig) {
      setError('Configura VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY in .env');
      return;
    }

    setLoading(true);
    try {
      const { error: authError } = mode === 'signup'
        ? await onSignUp(email, password)
        : await onSignIn(email, password);

      if (authError) throw authError;
      if (mode === 'signup') setError('Registrazione completata. Controlla la tua email.');
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="app-shell">
      <section className="auth-card">
        <p className="eyebrow">Accesso</p>
        <h1>{mode === 'signin' ? 'Accedi' : 'Registrati'}</h1>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@esempio.it"
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? 'Caricamento...' : mode === 'signin' ? 'Accedi' : 'Registrati'}
          </button>
        </form>

        <button
          type="button"
          className="switch-button"
          onClick={() => {
            setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
            setError('');
          }}
        >
          {mode === 'signin' ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}
        </button>

        {!hasSupabaseConfig && (
          <p className="config-note">
            Per usare il login, crea un file .env con VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.
          </p>
        )}
      </section>
    </main>
  );
}
