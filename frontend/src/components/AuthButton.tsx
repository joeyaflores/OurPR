"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from "@/components/ui/button";
import type { User } from '@supabase/supabase-js';

export default function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setIsLoading(false);
    };

    getUser();

    // Listen for auth changes to update button state
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      // Refresh the page on sign in/out to ensure server components update
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        router.refresh();
      }
    });

    // Cleanup listener on component unmount
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [supabase, router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    // router.refresh(); // Already handled by onAuthStateChange
  };

  const handleSignIn = () => {
    router.push('/login');
  };

  if (isLoading) {
    // Optional: Show a loading state or a placeholder button
    return <Button variant="outline" size="sm" disabled>Loading...</Button>; 
  }

  return user ? (
    <div className="flex items-center gap-4">
      <span className="text-sm text-muted-foreground hidden sm:inline">
        Hey, {user.email?.split('@')[0] ?? 'User'}!
      </span>
      <Button variant="outline" size="sm" onClick={handleSignOut}>Logout</Button>
    </div>
  ) : (
    <Button variant="outline" size="sm" onClick={handleSignIn}>Login</Button>
  );
} 