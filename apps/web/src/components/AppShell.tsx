"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/session";

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
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-6">
          <div className="flex items-center gap-8">
            <Link
              href="/app"
              className="font-display text-lg font-semibold tracking-tight text-ink hover:text-accent"
            >
              Guardrail Agent
            </Link>
            <nav className="hidden items-center gap-1 sm:flex" aria-label="Main">
              {nav.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-canvas-subtle text-ink"
                        : "text-ink-muted hover:bg-canvas-subtle hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <span className="hidden text-sm text-ink-muted sm:inline">{user.email}</span>
            ) : (
              <span className="hidden text-sm text-ink-muted sm:inline">Loading…</span>
            )}
            <button
              type="button"
              onClick={logout}
              className="text-sm text-ink-muted hover:text-ink"
              aria-label="Log out"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
