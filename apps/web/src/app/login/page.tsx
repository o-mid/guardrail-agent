"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { SiweMessage } from "siwe";
import { createWalletClient, custom, getAddress, type Address } from "viem";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/Button";
import { api } from "@/lib/api";
import { saveTokens } from "@/lib/session";

const inputClass =
  "mt-1.5 w-full border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function toHexMessage(message: string): `0x${string}` {
  const bytes = new TextEncoder().encode(message);
  let hex = "0x";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex as `0x${string}`;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [siweLoading, setSiweLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

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
      const eth = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
      if (!eth) {
        setError("No EVM wallet detected. Use email login or Anvil demo sign-in below.");
        return;
      }

      const challenge = await api<{
        nonce: string;
        domain: string;
        uri: string;
        chainId: number;
      }>("/api/auth/siwe/nonce", {
        method: "POST",
        body: "{}",
      });

      const walletClient = createWalletClient({
        transport: custom(eth),
      });
      const accounts = await walletClient.requestAddresses();
      const address = getAddress(accounts[0] as Address);

      const siwe = new SiweMessage({
        domain: challenge.domain,
        address,
        statement: "Sign in to Guardrail Agent",
        uri: challenge.uri,
        version: "1",
        chainId: challenge.chainId,
        nonce: challenge.nonce,
      });
      const message = siwe.prepareMessage();

      let signature: string;
      try {
        signature = await walletClient.signMessage({ account: address, message });
      } catch {
        // Fallback: MetaMask personal_sign with hex payload (more reliable on some injectors)
        signature = (await eth.request({
          method: "personal_sign",
          params: [toHexMessage(message), address],
        })) as string;
      }

      const data = await api<{ accessToken: string; refreshToken: string }>("/api/auth/siwe/verify", {
        method: "POST",
        body: JSON.stringify({ message, signature }),
      });
      saveTokens(data.accessToken, data.refreshToken);
      router.push("/app");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "siwe_failed";
      if (/user rejected|rejected the request|denied/i.test(msg)) {
        setError("Signature rejected in wallet");
      } else {
        setError(msg);
      }
    } finally {
      setSiweLoading(false);
    }
  }

  async function signInWithAnvilDemo() {
    setDemoLoading(true);
    setError(null);
    try {
      const data = await api<{ accessToken: string; refreshToken: string }>("/api/auth/siwe/demo", {
        method: "POST",
        body: "{}",
      });
      saveTokens(data.accessToken, data.refreshToken);
      router.push("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "demo_siwe_failed");
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col justify-center px-6 pb-28">
      <div className="mx-auto w-full max-w-md motion-safe:animate-mark-fade-in">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <BrandMark size="sm" />
          <span className="font-display text-lg font-semibold text-ink hover:text-accent">
            Guardrail Agent
          </span>
        </Link>
        <h1 className="mt-8 font-display text-3xl font-semibold tracking-tight text-ink">Log in</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Demo: <span className="font-mono text-ink">demo@guardrail.local</span> /{" "}
          <span className="font-mono text-ink">demopass123</span>
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4 atmosphere-panel p-5">
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

        <div className="mt-8 atmosphere-panel p-5">
          <p className="text-sm font-medium text-ink">Wallet sign-in</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            SIWE for local Anvil (chain 31337). Prefer Anvil demo if MetaMask fights localhost.
          </p>
          <Button
            variant="secondary"
            onClick={signInWithEthereum}
            disabled={siweLoading || demoLoading}
            className="mt-4 w-full text-sm"
            aria-label="Sign in with Ethereum wallet"
          >
            {siweLoading ? "Waiting for wallet…" : "Sign in with Ethereum"}
          </Button>
          <Button
            variant="secondary"
            onClick={signInWithAnvilDemo}
            disabled={siweLoading || demoLoading}
            className="mt-2 w-full text-sm"
            aria-label="Sign in with Anvil demo account"
          >
            {demoLoading ? "Signing…" : "Sign in with Anvil demo account"}
          </Button>
          <p className="mt-2 font-mono text-[11px] text-ink-muted">
            demo: 0xf39F…2266 (Anvil #0)
          </p>
        </div>
      </div>
    </main>
  );
}
