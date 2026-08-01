"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/Button";
import { api } from "@/lib/api";
import { saveTokens } from "@/lib/session";

const inputClass =
  "mt-1.5 w-full border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ accessToken: string; refreshToken: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      saveTokens(data.accessToken, data.refreshToken);
      router.push("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "register_failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col justify-center px-6">
      <div className="mx-auto w-full max-w-md">
        <Link href="/" className="font-display text-lg font-semibold text-ink hover:text-accent">
          Guardrail Agent
        </Link>
        <h1 className="mt-8 font-display text-3xl font-semibold text-ink">Register</h1>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-ink">
            Email
            <input
              className={inputClass}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm font-medium text-ink">
            Password (min 8 characters)
            <input
              className={inputClass}
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error ? (
            <p role="alert" className="rounded-sm border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creating…" : "Create account"}
          </Button>
        </form>

        <p className="mt-4 text-sm text-ink-muted">
          Already registered?{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
