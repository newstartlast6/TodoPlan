import { useState } from 'react';
import { useAuth } from '@/contexts/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Login() {
  const { isAuthEnabled, signInWithGoogle, signInWithPassword, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (!isAuthEnabled) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Login</h1>
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        <Button onClick={signInWithGoogle} variant="default" className="w-full">Sign in with Google</Button>
        <div className="text-center text-xs text-muted-foreground">or</div>
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); signInWithPassword(email, password); }}>
          <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button type="submit" className="w-full">Sign in</Button>
        </form>
      </div>
    </div>
  );
}


