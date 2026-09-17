import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { Providers } from "@/components/Providers";
import { cn } from "@/lib/utils";
import "./globals.css";

export const metadata: Metadata = {
  title: "Guardrail Agent",
  description: "Control plane for untrusted chain intents: PlanV1, Go policy, human approve, local vault.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("dark", GeistMono.variable)}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
