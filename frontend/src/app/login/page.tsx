"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link'; // <-- Import Link
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client'; // Import browser client
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator"; // Import Separator
import { FcGoogle } from "react-icons/fc"; // Import Google icon
import { PersonStanding } from "lucide-react"; // <-- Use PersonStanding instead

export default function LoginPage() {
  // console.log("LoginPage component rendered/rerendered"); // Keep logs minimal for now
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null); // For success messages like email confirmation
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false); // Loading state for Google button
  const router = useRouter();
  const supabase = createClient(); // Initialize browser client

  // Effect to handle redirection after successful OAuth login
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session); // Log auth state changes
      if (event === 'SIGNED_IN' && session) {
        // console.log('Detected SIGNED_IN event, redirecting to /');
        // router.push('/'); // Redirect to home
        console.log('Detected SIGNED_IN event, redirecting to /discover');
        router.push('/discover'); // Redirect to discover page
      }
      // Optional: Handle SIGNED_OUT or other events if needed
      // else if (event === 'SIGNED_OUT') {
      //   // Maybe clear some state or show a message
      // }
    });

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, router]); // Dependencies: supabase client and router

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
      setIsLoading(false); // Stop loading on error
    } else {
      // No need to setIsLoading(false) here as router.push will navigate away
      // The useEffect listener will handle the redirect after session is confirmed
      // router.push('/'); // Let the listener handle redirection
      console.log('Password sign-in successful, waiting for auth state change...');
    }
    // Ensure isLoading is always reset if not navigating away (e.g., on error)
    // setIsLoading(false); // Moved inside the error block
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
    setIsLoading(false); // Stop loading after sign up attempt (success or error)
  };

  // New handler for Google Sign In
  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setError(null);
    setMessage(null);
    console.log("Attempting Google Sign In");

    // Construct the redirect URL using environment variable
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const redirectUrl = `${siteUrl}/auth/callback`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl, // <-- Explicitly set redirectTo
      },
    });

    if (error) {
      console.error('Google Sign-in error:', error.message);
      setError(`Google Sign-in failed: ${error.message}`);
      setIsGoogleLoading(false); // Stop Google loading on error
    }
    // Supabase handles the redirect, the listener will handle navigation
  };

  return (
    // Add gradient background and ensure centering
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-b from-background to-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center"> {/* Center align header text */}
          <CardTitle className="text-2xl flex items-center justify-center gap-2">
             {/* Icon can be added here if desired */}
             {/* <PersonStanding className="h-6 w-6" /> */}
             Log In to OurPR
          </CardTitle>
          <CardDescription>
            Find your perfect race, track your PRs, and plan your season.
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
              disabled={isLoading || isGoogleLoading} // Disable if any action is loading
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
              disabled={isLoading || isGoogleLoading} // Disable if any action is loading
            />
          </div>
          {error && (
            <p className="text-sm font-medium text-destructive">Error: {error}</p>
          )}
          {message && (
            <p className="text-sm font-medium text-emerald-600">{message}</p> // Use a success color
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-4"> {/* Increased gap */}
          {/* Sign In button */}
          <Button onClick={handleSignIn} className="w-full" disabled={isLoading || isGoogleLoading}>
            {isLoading && !isGoogleLoading ? 'Signing In...' : 'Sign In with Email'}
          </Button>

          {/* Sign Up button */}
          <Button onClick={handleSignUp} variant="outline" className="w-full" disabled={isLoading || isGoogleLoading}>
            {isLoading ? 'Processing...' : 'Sign Up'}
          </Button>

          {/* Separator */}
           <div className="relative my-2">
             <div className="absolute inset-0 flex items-center">
               <span className="w-full border-t" />
             </div>
             <div className="relative flex justify-center text-xs uppercase">
               <span className="bg-background px-2 text-muted-foreground">
                 Or continue with
               </span>
             </div>
           </div>

          {/* Google Sign In Button */}
          <Button
            variant="outline"
            className="w-full flex items-center justify-center gap-2"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isLoading} // Disable if any action is loading
          >
            <FcGoogle className="h-5 w-5" /> {/* Google Icon */}
            {isGoogleLoading ? 'Redirecting...' : 'Continue with Google'}
          </Button>

          {/* Link to Sign Up Page */}
           <p className="mt-2 text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link href="/sign-up" className="underline hover:text-primary">
                Sign Up
              </Link>
            </p>
        </CardFooter>
      </Card>
    </main>
  );
} 