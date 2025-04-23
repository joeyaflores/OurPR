"use client"; // Assume client component for potential interaction

import React from 'react';
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react"; // Import Search icon

// Define props interface
interface ChatSearchInputProps {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ChatSearchInput: React.FC<ChatSearchInputProps> = ({ value, onChange }) => (
  // Add relative positioning to the main container
  <div className="relative mb-4 w-full max-w-2xl mx-auto p-4 border rounded-lg shadow-sm bg-background">
    {/* Top placeholder text */}
    <p className="text-muted-foreground text-center text-sm mb-2">
      Try searching by name, location, or describe the race you want...
    </p>
    {/* Container for icon and input */}
    <div className="relative flex items-center">
      {/* Position icon inside the input */}
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        type="search"
        placeholder="“Find me a flat half marathon in December...”"
        // Add padding-left to make space for the icon
        className="w-full pl-9 pr-3 py-2" // Adjust padding as needed
        value={value}
        onChange={onChange}
      />
    </div>
  </div>
); 