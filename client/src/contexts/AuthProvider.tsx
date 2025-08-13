import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getSupabaseClient, authEnabledOnClient } from '@/lib/supabaseClient';
import type { Session, User } from '@supabase/supabase-js';
import { useLocation } from 'wouter';

type AuthContextValue = {
  isAuthEnabled: boolean;
  isLoading: boolean;
  session: Session | null;
  user: User | null;
  error?: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(authEnabledOnClient);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authEnabledOnClient) {
      setIsLoading(false);
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      setIsLoading(false);
      return;
    }
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setError(error?.message ?? null);
      setIsLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!authEnabledOnClient) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) setError(error.message);
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!authEnabledOnClient) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    if (!authEnabledOnClient) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setError(null);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setError(error.message);
  }, []);

  const signOut = useCallback(async () => {
    if (!authEnabledOnClient) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setError(null);
    const { error } = await supabase.auth.signOut();
    if (error) setError(error.message);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    isAuthEnabled: authEnabledOnClient,
    isLoading,
    session,
    user,
    error,
    signInWithGoogle,
    signInWithPassword,
    signUpWithPassword,
    signOut,
  }), [isLoading, session, user, error, signInWithGoogle, signInWithPassword, signUpWithPassword, signOut]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthEnabled, isLoading, user } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isAuthEnabled) return;
    if (!isLoading && !user) navigate('/login');
  }, [isAuthEnabled, isLoading, user, navigate]);

  if (!isAuthEnabled) return <>{children}</>;
  if (isLoading) return null;
  if (!user) return null;
  return <>{children}</>;
}


