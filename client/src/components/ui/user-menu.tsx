import { useAuth } from '@/contexts/AuthProvider';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './dropdown-menu';
import { Button } from './button';

export function UserMenu() {
  const { isAuthEnabled, user, signOut } = useAuth();
  if (!isAuthEnabled || !user) return null;
  const label = user.email || user.user_metadata?.name || 'Account';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 px-2 text-sm">{label}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={() => signOut()}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


