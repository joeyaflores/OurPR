import Link from "next/link";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        {/* Site Name / Logo - Removed */}
        {/* <Link href="/" className="mr-6 flex items-center space-x-2">
          <span className="font-bold sm:inline-block">OurPR</span>
        </Link> */}

        {/* Wrapper to center the Nav */}
        <div className="flex flex-1 items-center justify-center">
          <nav className="flex items-center space-x-4 lg:space-x-6">
            <Link href="/" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
              Home
            </Link>
            <Link href="/discover" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
              Discover Races
            </Link>
            <Link href="/groups" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
              Training Groups
            </Link>
            <Link href="/ai-tools" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
              AI Tools
            </Link>
          </nav>
        </div>

        {/* Spacer to push actions to the right */}
        <div className="flex flex-1 items-center justify-end space-x-2">
          {/* Right side actions */}
          <Button variant="ghost" size="sm">
            Log In
          </Button>
          <Button size="sm">
            Sign Up
          </Button>
          {/* Add Theme Toggle later */}
        </div>
      </div>
    </header>
  );
} 