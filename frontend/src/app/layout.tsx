import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { SiteHeader } from "@/components/SiteHeader";
import AuthButton from "@/components/AuthButton";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://ourpr.app'),
  title: {
    template: '%s | Our PR',
    default: 'Our PR - Running Log, Race Discovery, PR Tracking',
  },
  description: 'Log your runs, track personal records, discover new races, generate training plans, and achieve your running goals with Our PR.',
  openGraph: {
    title: {
      template: '%s | Our PR',
      default: 'Our PR - Running Log, Race Discovery, PR Tracking',
    },
    description: 'Log your runs, track personal records, discover new races, generate training plans, and achieve your running goals with Our PR.',
    siteName: 'Our PR',
    locale: 'en_US',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          geistSans.variable,
          geistMono.variable
        )}
      >
        <div className="relative flex min-h-screen flex-col">
          <SiteHeader />
          <div className="flex-1">{children}</div>
          <Toaster richColors />
        </div>
        <Analytics />
      </body>
    </html>
  );
}
