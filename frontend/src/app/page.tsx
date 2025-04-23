import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold tracking-tight">
            🏃‍♂️ OurPR
          </CardTitle>
          <CardDescription>
            AI-Powered Race Discovery & Training Platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            Welcome to OurPR! Discover races, find training partners, and unlock
            personalized insights to chase your next Personal Record (PR). Built
            with modern tools, social features, and AI augmentation, OurPR is
            where community meets performance.
          </p>
          {/* Add more content or components here later */}
        </CardContent>
      </Card>
    </main>
  );
}
