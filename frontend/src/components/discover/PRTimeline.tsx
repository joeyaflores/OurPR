'use client'; // Likely needs client-side interaction for scrolling/state later

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

// TODO: Define props if this component needs data later
// interface PRTimelineProps {}

export const PRTimeline: React.FC = () => {
  // Placeholder data for timeline items
  const timelineItems = [
    {
      id: 1,
      title: "Oct Race Prep",
      description: "Dallas Downtown Dash (10K) aligns with peak training.",
      dateStatus: "On Track"
    },
    {
      id: 2,
      title: "Sept Race Option",
      description: "Austin River Run (Half) could be a good tune-up.",
      dateStatus: "Consider"
    },
    {
      id: 3,
      title: "Late Season 5K",
      description: "Fort Worth Flat 5K offers a final speed opportunity.",
      dateStatus: "Possible"
    }
    // Add more placeholder items
  ];

  return (
    <section className="w-full max-w-7xl mx-auto mt-8 p-4 border rounded-lg shadow-sm bg-background">
      <h3 className="text-lg font-semibold mb-4">Your PR Timeline</h3>
      {/* Horizontal Scroll Container */}
      <div className="flex space-x-4 overflow-x-auto pb-4"> {/* Added pb-4 for scrollbar space */}
        {timelineItems.map((item) => (
          <Card key={item.id} className="min-w-[250px] flex-shrink-0"> {/* Min width for items */}
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">Status: {item.dateStatus}</p>
              <Button variant="outline" size="sm" className="w-full" disabled>
                <PlusCircle className="mr-2 h-4 w-4" /> Add to Plan
              </Button>
            </CardContent>
          </Card>
        ))}
         {/* Placeholder if no items */}
         {timelineItems.length === 0 && (
           <p className="text-muted-foreground text-sm">No races align with your current goals/timeline yet.</p>
         )}
      </div>
    </section>
  );
}; 