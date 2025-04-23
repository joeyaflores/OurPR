import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <h1 className="text-2xl font-semibold mb-4 text-destructive">Authentication Error</h1>
      <p className="mb-6 text-muted-foreground max-w-md">
        Something went wrong during the authentication process. This might happen if the link has expired, was already used, or if there was a configuration issue.
      </p>
      <Link href="/login" passHref>
        <Button>Go back to Login</Button>
      </Link>
    </main>
  );
} 