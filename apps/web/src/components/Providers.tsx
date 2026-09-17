"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { GuideBot } from "./GuideBot";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      {children}
      <GuideBot />
    </TooltipProvider>
  );
}
