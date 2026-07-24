"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/session";

type User = { id: string; email: string; evmAddress?: string | null; solanaPubkey?: string | null };

export default function AppHome() {
  const router = useRouter();
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

  if (!user) {
    return <main className="mx-auto max-w-3xl px-6 py-16 text-sm text-ink/70">Loading…</main>;
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-display text-3xl">Guardrail Agent</h1>
        <button
          className="text-sm underline"
          onClick={() => {
            clearTokens();
            router.push("/login");
          }}
        >
          Log out
        </button>
      </div>
      <p className="mt-2 text-sm text-ink/70">{user.email}</p>
      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link className="bg-accent px-4 py-2 text-white" href="/app/compose">
          Compose intent
        </Link>
        <Link className="border border-line bg-paper/70 px-4 py-2" href="/app/audit">
          Audit
        </Link>
      </div>
    </main>
  );
}
