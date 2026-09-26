import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { TABLES, COLUMNS } from '../lib/schema';

export function useAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const hasSupabaseConfig = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  );

  useEffect(() => {
    if (!supabase) {
      setSession(null);
      setLoading(false);
      return;
    }

    const restoreSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setLoading(false);
    };

    restoreSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signUp = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
  }, []);

  const ensureProfile = useCallback(async (user) => {
    if (!supabase || !user) return;

    const { error } = await supabase.from(TABLES.PROFILES).upsert(
      {
        [COLUMNS.PROFILES.ID]: user.id,
        [COLUMNS.PROFILES.FULL_NAME]: user.email?.split('@')[0] || 'Utente',
      },
      { onConflict: COLUMNS.PROFILES.ID }
    );

    if (error) {
      console.error('Errore creazione profilo:', error);
    }
  }, []);

  return {
    session,
    loading,
    hasSupabaseConfig,
    signIn,
    signUp,
    signOut,
    ensureProfile,
  };
}
