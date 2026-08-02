"use client";

import { GuideBot } from "./GuideBot";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <GuideBot />
    </>
  );
}
