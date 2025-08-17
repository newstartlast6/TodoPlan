import { useState, useEffect } from 'react';
import { getSupabaseClient, authEnabledOnClient } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(authEnabledOnClient);

  useEffect(() => {
    if (!authEnabledOnClient) {
      setIsLoading(false);
      return;
    }
    (async () => {
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase!.auth.getSession();
        setHasRecoverySession(Boolean(data.session));
      } catch {}
      setIsLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center p-6">
        <div className="w-full rounded-2xl border border-slate-200 bg-white/70 backdrop-blur p-6 shadow-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-black text-white flex items-center justify-center font-bold">T</div>
            <h1 className="text-lg font-semibold tracking-tight">Reset password</h1>
            <p className="mt-1 text-xs text-slate-500">Enter a new password to complete recovery.</p>
          </div>

          {!authEnabledOnClient ? (
            <div className="mb-3 text-xs rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
              Authentication is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable password reset.
            </div>
          ) : null}

          {isLoading ? null : !hasRecoverySession && authEnabledOnClient ? (
            <div className="mb-3 text-xs rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
              This page must be opened from the password reset link sent to your email.
            </div>
          ) : null}

          {status ? <div className="mb-3 text-xs rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{status}</div> : null}
          {error ? <div className="mb-3 text-xs rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">{error}</div> : null}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setStatus(null);
              if (!authEnabledOnClient) return;
              const supabase = getSupabaseClient();
              if (!supabase) return;
              const { error } = await supabase.auth.updateUser({ password: newPassword });
              if (error) setError(error.message);
              else setStatus('Password updated. You can close this window.');
            }}
            className="space-y-3"
          >
            <Input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              className="h-9"
              disabled={!authEnabledOnClient}
            />
            <Button type="submit" className="w-full h-9" disabled={!authEnabledOnClient || !hasRecoverySession}>
              Update password
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}


