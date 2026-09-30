import { useState } from 'react';

function formatAuthError(error) {
  const message = error?.message || 'Si è verificato un errore.';
  const lower = message.toLowerCase();

  if (lower.includes('load failed') || lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Supabase non è raggiungibile. Controlla le variabili VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.';
  }
  if (lower.includes('signups are disabled') || lower.includes('sign up is disabled')) {
    return 'La registrazione email è disattivata in Supabase. Abilitala in Authentication → Providers → Email.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Controlla la tua email e conferma l’indirizzo prima di accedere.';
  }
  if (lower.includes('invalid login credentials')) {
    return 'Credenziali non valide.';
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
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!email.trim() || !password.trim()) {
      setError('Inserisci email e password.');
      return;
    }
    if (!hasSupabaseConfig) {
      setError('Configura VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nel file .env');
      return;
    }

    setLoading(true);
    try {
      const { error: authError } =
        mode === 'signup' ? await onSignUp(email, password) : await onSignIn(email, password);

      if (authError) throw authError;
      if (mode === 'signup') setNotice('Registrazione completata. Controlla la tua email.');
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-card">
        <p className="eyebrow">Project Spesa</p>
        <h1>{mode === 'signin' ? 'Accedi' : 'Registrati'}</h1>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@esempio.it"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              required
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
            />
          </label>

          {error ? <p className="alert">{error}</p> : null}
          {notice ? <p className="alert" style={{ background: 'rgba(52,199,89,.14)', color: '#1b7f37' }}>{notice}</p> : null}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Attendi…' : mode === 'signin' ? 'Accedi' : 'Registrati'}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'signin' ? 'Non hai un account? ' : 'Hai già un account? '}
          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
              setError('');
              setNotice('');
            }}
          >
            {mode === 'signin' ? 'Registrati' : 'Accedi'}
          </button>
        </p>

        {!hasSupabaseConfig && (
          <p className="config-note">
            Per usare il login crea un file <code>.env</code> con VITE_SUPABASE_URL e
            VITE_SUPABASE_ANON_KEY.
          </p>
        )}
      </div>
    </div>
  );
}
