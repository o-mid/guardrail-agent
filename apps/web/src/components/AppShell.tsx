"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/session";
import { BrandMark } from "./BrandMark";

type User = { id: string; email: string };

const nav = [
  { href: "/app/compose", label: "Compose" },
  { href: "/app/audit", label: "Audit" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    api<{ user: User }>("/api/me", { token })
      .then((d) => setUser(d.user))
      .catch(() => {
        clearTokens();
        router.replace("/login");
      });
  }, [router]);

  function logout() {
    clearTokens();
    router.push("/login");
  }

  return (
    <div className="min-h-screen">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-6">
          <div className="flex items-center gap-7">
            <Link
              href="/app"
              className="group flex items-center gap-2.5 font-display text-lg font-semibold tracking-tight text-ink"
            >
              <BrandMark size="sm" />
              <span className="transition-colors group-hover:text-accent">Guardrail Agent</span>
            </Link>
            <nav className="hidden items-center gap-0.5 sm:flex" aria-label="Main">
              {nav.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative px-3 py-1.5 text-sm font-medium transition-colors ${
                      active ? "text-ink" : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    {item.label}
                    {active ? (
                      <span
                        aria-hidden
                        className="absolute inset-x-3 -bottom-[13px] h-0.5 bg-accent"
                      />
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <span className="hidden max-w-[12rem] truncate text-sm text-ink-muted sm:inline">
                {user.email}
              </span>
            ) : (
              <span className="hidden text-sm text-ink-muted sm:inline">Loading…</span>
            )}
            <button
              type="button"
              onClick={logout}
              className="text-sm text-ink-muted transition-colors hover:text-ink"
              aria-label="Log out"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-6 py-10 pb-28">
        {children}
      </main>
    </div>
  );
}
