import { useState } from 'react';
import { useAuth } from '@/contexts/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getSupabaseClient } from '@/lib/supabaseClient';

export default function Login() {
  const { isAuthEnabled, signInWithGoogle, signInWithPassword, signUpWithPassword, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [status, setStatus] = useState<string | null>(null);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center p-6">
        <div className="w-full rounded-2xl border border-slate-200 bg-white/70 backdrop-blur p-6 shadow-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-black text-white flex items-center justify-center font-bold">T</div>
            <h1 className="text-lg font-semibold tracking-tight">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h1>
            <p className="mt-1 text-xs text-slate-500">Plan. Focus. Finish.</p>
          </div>

          {!isAuthEnabled ? (
            <div className="mb-3 text-xs rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
              Authentication is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your client env to enable login.
            </div>
          ) : null}
          {error ? <div className="mb-3 text-xs rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">{error}</div> : null}
          {status ? <div className="mb-3 text-xs rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{status}</div> : null}

          <div className="space-y-3">
            <Button onClick={signInWithGoogle} variant="outline" className="w-full h-9 border-slate-300" disabled={!isAuthEnabled}>
              Continue with Google
            </Button>
            <div className="relative text-center">
              <span className="bg-white px-2 text-[10px] text-slate-400 relative z-10">or</span>
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t border-dashed border-slate-200" />
            </div>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                setStatus(null);
                return mode === 'signin'
                  ? signInWithPassword(email, password)
                  : signUpWithPassword(email, password);
              }}
            >
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-9" disabled={!isAuthEnabled} />
              <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-9" disabled={!isAuthEnabled} />
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="text-[11px] text-slate-500 hover:text-slate-700"
                  onClick={async () => {
                    setStatus(null);
                    const supabase = getSupabaseClient();
                    if (!supabase || !email) return;
                    const { error } = await supabase.auth.resetPasswordForEmail(email, {
                      redirectTo: `${window.location.origin}/reset-password`,
                    });
                    if (error) return;
                    setStatus('Password reset link sent to your email.');
                  }}
                  disabled={!isAuthEnabled}
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  className="text-[11px] text-slate-500 hover:text-slate-700"
                  onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                >
                  {mode === 'signin' ? 'Create account' : 'Have an account? Sign in'}
                </button>
              </div>
              <Button type="submit" className="w-full h-9" disabled={!isAuthEnabled}>
                {mode === 'signin' ? 'Sign in' : 'Sign up'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}


