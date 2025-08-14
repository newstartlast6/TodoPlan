import { useState, useEffect } from 'react';
import { getSupabaseClient, authEnabledOnClient } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authEnabledOnClient) return;
    const supabase = getSupabaseClient();
    // Supabase will set a session if invited via recovery link
    // Nothing to do here; the form submission will update the password
  }, []);

  if (!authEnabledOnClient) return null;

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Set a new password</h1>
        {status ? <div className="text-sm text-green-700">{status}</div> : null}
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setStatus(null);
            const supabase = getSupabaseClient();
            if (!supabase) return;
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) setError(error.message);
            else setStatus('Password updated. You can close this window.');
          }}
          className="space-y-2"
        >
          <Input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
          />
          <Button type="submit" className="w-full">Update password</Button>
        </form>
      </div>
    </div>
  );
}


