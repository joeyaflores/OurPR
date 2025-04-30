"use client"; // Add this if not present, needed for useState

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import AuthButton from "./AuthButton";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react"; // Removed X as it's handled by SheetClose/Overlay click

export function SiteHeader() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const closeSheet = () => setIsSheetOpen(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Apply justify-between and add explicit horizontal padding */}
      <div className="container flex h-14 max-w-screen-2xl items-center justify-between px-4">
        {/* Site Name / Logo */}
        <Link href="/" className="mr-6 flex items-center space-x-2" onClick={closeSheet}>
          <span className="font-bold">OurPR</span> {/* Simplified logo */}
        </Link>

        {/* Desktop Navigation (Hidden on Mobile) */}
        <nav className="hidden items-center space-x-4 md:flex lg:space-x-6">
          <Link href="/" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
            Home
          </Link>
          <Link href="/discover" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
            Discover Races
          </Link>
          <Link href="/plan" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
            My Plan
          </Link>
          {/* <Link href="/groups" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
              Training Groups
            </Link>
            <Link href="/ai-tools" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
              AI Tools
            </Link> */}
        </nav>

        <div className="flex items-center space-x-2">
          {/* Auth button - always visible */}
          <div className="hidden md:flex"> {/* Hide Auth button momentarily on mobile before sheet trigger appears */}
             <AuthButton />
          </div>

          {/* Mobile Menu Trigger (Hidden on Desktop) */}
          <div className="md:hidden">
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[240px] sm:w-[300px]">
                <SheetHeader className="sr-only">
                  <SheetTitle>Navigation Menu</SheetTitle>
                </SheetHeader>
                <nav className="mt-10 flex flex-col space-y-4 px-4">
                  {/* Wrap links in SheetClose */}
                  <SheetClose asChild>
                    <Link href="/" className="text-lg font-medium text-foreground transition-colors hover:text-primary">
                      Home
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link href="/discover" className="text-lg font-medium text-foreground transition-colors hover:text-primary">
                      Discover Races
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link href="/plan" className="text-lg font-medium text-foreground transition-colors hover:text-primary">
                      My Plan
                    </Link>
                  </SheetClose>
                  {/* Add other mobile links here */}
                  <div className="pt-6"> {/* Add AuthButton inside Sheet for mobile */}
                    <SheetClose asChild>
                       <AuthButton />
                    </SheetClose>
                   </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
          {/* Ensure AuthButton is correctly placed for mobile view - handled inside SheetContent */}
           <div className="flex md:hidden"> {/* Show Auth button next to menu on small screens */}
             <AuthButton />
          </div>
        </div>
      </div>
    </header>
  );
} 