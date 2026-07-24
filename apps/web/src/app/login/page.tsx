"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { saveTokens } from "@/lib/session";

export default function LoginPage() {
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

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="font-display text-3xl">Log in</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block text-sm">
          Email
          <input
            className="mt-1 w-full border border-line bg-paper/80 px-3 py-2"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            className="mt-1 w-full border border-line bg-paper/80 px-3 py-2"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-sm text-ink/70">
        No account? <Link href="/register">Register</Link>
      </p>
      <div className="mt-8 border-t border-line pt-6">
        <p className="text-sm font-medium">Wallet sign-in</p>
        <p className="mt-1 text-xs text-ink/60">
          SIWE (EVM) and Solana message sign hit the API when a browser wallet is available. Email
          login stays the default for the Compose demo.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="border border-line bg-paper/70 px-3 py-2 text-xs"
            onClick={async () => {
              setError(null);
              try {
                const eth = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
                if (!eth) {
                  setError("no_evm_wallet");
                  return;
                }
                const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
                const address = accounts[0];
                const { nonce } = await api<{ nonce: string }>("/api/auth/siwe/nonce", { method: "POST", body: "{}" });
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
              }
            }}
          >
            Sign in with Ethereum
          </button>
        </div>
      </div>
    </main>
  );
}
