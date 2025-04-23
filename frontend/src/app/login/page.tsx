"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client'; // Import browser client
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  // console.log("LoginPage component rendered/rerendered"); // Keep logs minimal for now
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null); // For success messages like email confirmation
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient(); // Initialize browser client

  const handleSignIn = async () => {
    // console.log("handleSignIn function called"); 
    setIsLoading(true);
    setError(null);
    setMessage(null);

    console.log(`Attempting SIGN IN for email: ${email}`); // Log before Supabase call
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Sign-in error:', error.message);
      setError(error.message);
    } else {
      router.refresh(); // Refresh to update auth state via middleware
    }
    setIsLoading(false);
  };

  const handleSignUp = async () => {
    // console.log("handleSignUp function called"); 
    setIsLoading(true);
    setError(null);
    setMessage(null);
    
    console.log(`Attempting SIGN UP for email: ${email}`); // Log before Supabase call
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      console.error('Sign-up error:', error.message);
      setError(error.message);
    } else {
      setMessage('Check your email to confirm sign up!'); // Success message
    }
    setIsLoading(false);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Login / Sign Up</CardTitle>
          <CardDescription>
            Enter your email and password below.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input 
              id="password" 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>
          {error && (
            <p className="text-sm font-medium text-destructive">Error: {error}</p>
          )}
          {message && (
            <p className="text-sm font-medium text-emerald-600">{message}</p> // Use a success color
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          {/* Temporarily comment out Sign In button */}
          {/* 
          <Button onClick={handleSignIn} className="w-full" disabled={isLoading}>
            {isLoading ? 'Processing...' : 'Sign In'}
          </Button>
          */}
          
          {/* Sign Up button */}
          <Button onClick={() => handleSignUp()} variant="outline" className="w-full" disabled={isLoading}>
            {isLoading ? 'Processing...' : 'Sign Up'}
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
} 