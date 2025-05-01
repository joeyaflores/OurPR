'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
// Remove Lucide icons, will be replaced by Lottie
// import { Activity, Search, Trophy, CalendarClock, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
// Import Lottie dynamically again
import dynamic from 'next/dynamic';

// Import animation data directly
import runningLogAnimation from '../../../public/lotties/running-log.json';
import raceDiscoveryAnimation from '../../../public/lotties/race-discovery.json';
import trophyGoalAnimation from '../../../public/lotties/trophy-goal.json';
import calendarPlanAnimation from '../../../public/lotties/calendar-plan.json';

// Dynamically import Lottie, disable SSR
const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

// Animation Variants
const sectionVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut",
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
       duration: 0.5,
       ease: "easeOut",
    }
  }
};

export function LandingPage() {
  return (
    <div className="w-full overflow-x-hidden"> {/* Prevent horizontal scroll from animations */}
      {/* === Hero Section === */}
      <motion.section 
        className="w-full py-20 md:py-32 lg:py-40 bg-gradient-to-br from-primary/20 via-background to-background text-center px-4"
        initial="hidden"
        animate="visible"
        variants={sectionVariants}
      >
        <div className="container mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl mb-4">
            Beyond Listings: Find Your Perfect Race, Get Your Custom Plan.
          </h1>
          <p className="text-lg text-muted-foreground md:text-xl lg:text-2xl mb-8">
            Stop scrolling endless race calendars. Our PR uses unique insights to uncover races matched to your potential and instantly generates personalized training plans. Track everything, achieve more.
          </p>
          <Link href="/login" passHref>
            <Button size="lg" className="text-lg px-8 py-6">Get Started Free</Button>
          </Link>
          {/* Optional: Add a subtle visual element later, like an illustration or app screenshot */}
        </div>
      </motion.section>

      {/* === Features Section === */}
      <motion.section 
        className="w-full py-16 md:py-24 lg:py-32 bg-background px-4"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }} // Trigger animation when 10% is visible
        variants={sectionVariants}
      >
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-16 md:mb-24"> 
            Everything You Need To Reach Your Running Goals
          </h2>
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10"
            variants={{ // Stagger children within the grid
              visible: { transition: { staggerChildren: 0.1 } }
            }}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
          >
            {/* Feature 1 (Now): Smart Race Finder */}
            <motion.div 
              className="flex flex-col items-center text-center p-6 rounded-lg border border-border/50 bg-card/30 shadow-sm transition-all duration-200 ease-out hover:shadow-md"
              variants={itemVariants}
              whileHover={{ scale: 1.03 }}
            >
              {/* Use animationData prop */}
              <Lottie 
                animationData={raceDiscoveryAnimation} 
                loop={true} 
                style={{ width: 80, height: 80, marginBottom: '1.25rem' }} 
               />
              <h3 className="text-xl font-semibold mb-2 text-primary">Smart Race Finder</h3>
              <p className="text-muted-foreground text-sm">
                Tired of generic race lists? Go beyond basic filters. Use natural language search, PR Potential scores, and detailed course insights to discover races *truly* suited for your next personal best.
              </p>
            </motion.div>

            {/* Feature 2 (Now): Plan Your Season */}
             <motion.div 
               className="flex flex-col items-center text-center p-6 rounded-lg border border-border/50 bg-card/30 shadow-sm transition-all duration-200 ease-out hover:shadow-md"
               variants={itemVariants}
               whileHover={{ scale: 1.03 }}
             >
              {/* Use animationData prop */}
              <Lottie 
                animationData={calendarPlanAnimation} 
                loop={true} 
                style={{ width: 80, height: 80, marginBottom: '1.25rem' }} 
              />
              <h3 className="text-xl font-semibold mb-2 text-primary">Plan Your Season</h3>
              <p className="text-muted-foreground text-sm">
                Stop guesswork and spreadsheet headaches. Select your goal race and instantly generate a week-by-week training schedule tailored to your event and timeline.
              </p>
            </motion.div>

            {/* Feature 3 (Now): Track PRs & Goals */}
            <motion.div 
              className="flex flex-col items-center text-center p-6 rounded-lg border border-border/50 bg-card/30 shadow-sm transition-all duration-200 ease-out hover:shadow-md"
              variants={itemVariants}
              whileHover={{ scale: 1.03 }}
            >
              {/* Use animationData prop */}
              <Lottie 
                animationData={trophyGoalAnimation} 
                loop={true} 
                style={{ width: 80, height: 80, marginBottom: '1.25rem' }} 
               />
              <h3 className="text-xl font-semibold mb-2 text-primary">Track PRs & Goals</h3>
              <p className="text-muted-foreground text-sm">
                Monitor progress across distances. Set weekly targets and see how training contributes to achieving race goals and unlocking new PRs.
              </p>
            </motion.div>

            {/* Feature 4 (Now): Logging */}
            <motion.div 
              className="flex flex-col items-center text-center p-6 rounded-lg border border-border/50 bg-card/30 shadow-sm transition-all duration-200 ease-out hover:shadow-md"
              variants={itemVariants}
              whileHover={{ scale: 1.03 }}
            >
              {/* Use animationData prop */}
              <Lottie 
                animationData={runningLogAnimation}
                loop={true} 
                style={{ width: 80, height: 80, marginBottom: '1.25rem' }} 
              />
              <h3 className="text-xl font-semibold mb-2 text-primary">Log Every Run</h3>
              <p className="text-muted-foreground text-sm">
                Easily log workouts, notes, and effort. See activities automatically mapped against your training plan and contributing to weekly goals.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      {/* === How It Works Section (Optional) === */}
      <motion.section 
        className="w-full py-16 md:py-24 lg:py-32 bg-gradient-to-b from-muted/30 to-background px-4"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        variants={sectionVariants}
      >
         <div className="container mx-auto max-w-4xl text-center">
            <h2 className="text-3xl font-bold tracking-tight mb-20 md:mb-24"> 
              Get Started in Minutes
            </h2>
            <motion.div 
              className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12" /* Increased gap */
              variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.1 }}
            >
               <motion.div className="flex flex-col items-center" variants={itemVariants}>
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-accent text-accent-foreground font-bold text-2xl mb-4 shadow-md">1</div>
                  <h3 className="text-lg font-semibold mb-1">Sign Up Free</h3>
                  <p className="text-sm text-muted-foreground">Create your account quickly.</p>
               </motion.div>
               <motion.div className="flex flex-col items-center" variants={itemVariants}>
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-accent text-accent-foreground font-bold text-2xl mb-4 shadow-md">2</div>
                  <h3 className="text-lg font-semibold mb-1">Discover & Plan</h3>
                  <p className="text-sm text-muted-foreground">Find your ideal race using smart insights & instantly generate your training plan.</p>
               </motion.div>
               <motion.div className="flex flex-col items-center" variants={itemVariants}>
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-accent text-accent-foreground font-bold text-2xl mb-4 shadow-md">3</div>
                  <h3 className="text-lg font-semibold mb-1">Train & Achieve</h3>
                  <p className="text-sm text-muted-foreground">Follow your plan, track your progress, and smash your next PR.</p>
               </motion.div>
            </motion.div>
         </div>
      </motion.section>

      {/* === Final CTA Section === */}
      <motion.section 
        className="w-full py-20 md:py-28 lg:py-36 bg-gradient-to-tr from-accent/10 via-background to-background text-center px-4"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={sectionVariants}
      >
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-6">
            Ready for Your Best Race Season Yet?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Get started with intelligent race discovery and personalized plans designed to help you reach your potential.
          </p>
          <Link href="/login" passHref>
            <Button size="lg" className="text-lg px-8 py-6">Sign Up Free Today</Button>
          </Link>
        </div>
      </motion.section>

       {/* === Footer (Optional - Consider a shared footer component later) === */}
       <footer className="w-full py-6 text-center text-xs text-muted-foreground border-t">
           © {new Date().getFullYear()} OurPR. All rights reserved.
       </footer>

    </div>
  );
} 