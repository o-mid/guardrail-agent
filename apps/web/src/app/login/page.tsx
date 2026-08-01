"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/Button";
import { api } from "@/lib/api";
import { saveTokens } from "@/lib/session";

const inputClass =
  "mt-1.5 w-full border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [siweLoading, setSiweLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ accessToken: string; refreshToken: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      saveTokens(data.accessToken, data.refreshToken);
      router.push("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "login_failed");
    } finally {
      setLoading(false);
    }
  }

  async function signInWithEthereum() {
    setSiweLoading(true);
    setError(null);
    try {
      const eth = (
        window as unknown as {
          ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
        }
      ).ethereum;
      if (!eth) {
        setError("No EVM wallet detected");
        return;
      }
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      const address = accounts[0];
      const { nonce } = await api<{ nonce: string }>("/api/auth/siwe/nonce", {
        method: "POST",
        body: "{}",
      });
      const domain = window.location.host;
      const uri = window.location.origin;
      const message = `${domain} wants you to sign in with your Ethereum account:\n${address}\n\nGuardrail Agent\n\nURI: ${uri}\nVersion: 1\nChain ID: 31337\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}`;
      const signature = (await eth.request({
        method: "personal_sign",
        params: [message, address],
      })) as string;
      const data = await api<{ accessToken: string; refreshToken: string }>("/api/auth/siwe/verify", {
        method: "POST",
        body: JSON.stringify({ message, signature }),
      });
      saveTokens(data.accessToken, data.refreshToken);
      router.push("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "siwe_failed");
    } finally {
      setSiweLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col justify-center px-6">
      <div className="mx-auto w-full max-w-md">
        <Link href="/" className="font-display text-lg font-semibold text-ink hover:text-accent">
          Guardrail Agent
        </Link>
        <h1 className="mt-8 font-display text-3xl font-semibold text-ink">Log in</h1>

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
            Password
            <input
              className={inputClass}
              type="password"
              autoComplete="current-password"
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
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-4 text-sm text-ink-muted">
          No account?{" "}
          <Link href="/register" className="font-medium text-accent hover:underline">
            Register
          </Link>
        </p>

        <div className="mt-10 border-t border-line pt-8">
          <p className="text-sm font-medium text-ink">Wallet sign-in</p>
          <p className="mt-1 text-xs text-ink-muted">
            Optional. Email login is the default for the Compose demo.
          </p>
          <Button
            variant="secondary"
            onClick={signInWithEthereum}
            disabled={siweLoading}
            className="mt-4 w-full text-sm"
            aria-label="Sign in with Ethereum wallet"
          >
            {siweLoading ? "Connecting…" : "Sign in with Ethereum"}
          </Button>
        </div>
      </div>
    </main>
  );
}
