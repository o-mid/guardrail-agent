"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { SiweMessage } from "siwe";
import { createWalletClient, custom, getAddress, type Address } from "viem";
import { BrandMark } from "@/components/BrandMark";
import { KeyIcon } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { saveTokens } from "@/lib/session";

const DEMO_EMAIL = "demo@guardrail.local";
const DEMO_PASSWORD = "demopass123";

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

  async function loginWith(nextEmail: string, nextPassword: string) {
    const data = await api<{ accessToken: string; refreshToken: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: nextEmail.trim(), password: nextPassword }),
    });
    saveTokens(data.accessToken, data.refreshToken);
    router.push("/app/compose");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await loginWith(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "login_failed");
    } finally {
      setLoading(false);
    }
  }

  async function signInDemo() {
    setDemoLoading(true);
    setError(null);
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    try {
      await loginWith(DEMO_EMAIL, DEMO_PASSWORD);
    } catch (err) {
      setError(err instanceof Error ? err.message : "login_failed");
    } finally {
      setDemoLoading(false);
    }
  }

  async function signInWithEthereum() {
    setSiweLoading(true);
    setError(null);
    try {
      const eth = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
      if (!eth) {
        setError("No EVM wallet detected. Use email or Anvil demo sign-in.");
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
      router.push("/app/compose");
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
      router.push("/app/compose");
    } catch (err) {
      setError(err instanceof Error ? err.message : "demo_siwe_failed");
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col justify-center px-4 py-12 sm:px-6">
      <div className="mx-auto w-full max-w-md motion-safe:animate-mark-fade-in">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <BrandMark size="sm" />
          <span className="text-sm font-semibold">Guardrail Agent</span>
        </Link>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight">Log in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Console access for the local demo stack.
        </p>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Email</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Signing in…" : "Sign in"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={demoLoading || loading}
                className="w-full"
                onClick={signInDemo}
              >
                Sign in as demo
              </Button>
              <p className="text-xs text-muted-foreground">
                <Kbd>{DEMO_EMAIL}</Kbd> / <Kbd>{DEMO_PASSWORD}</Kbd>
              </p>
            </form>
          </CardContent>
        </Card>

        <p className="mt-4 text-sm text-muted-foreground">
          No account?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Register
          </Link>
        </p>

        <Separator className="my-6" />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyIcon className="size-4" />
              Wallet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              SIWE on local Anvil (chain 31337). Prefer Anvil demo if MetaMask fights localhost.
            </p>
            <Button
              variant="secondary"
              onClick={signInWithEthereum}
              disabled={siweLoading || demoLoading}
              className="w-full"
              aria-label="Sign in with Ethereum wallet"
            >
              {siweLoading ? "Waiting for wallet…" : "Sign in with Ethereum"}
            </Button>
            <Button
              variant="secondary"
              onClick={signInWithAnvilDemo}
              disabled={siweLoading || demoLoading}
              className="w-full"
              aria-label="Sign in with Anvil demo account"
            >
              {demoLoading ? "Signing…" : "Sign in with Anvil demo account"}
            </Button>
            <p className="font-mono text-[11px] text-muted-foreground">0xf39F…2266 (Anvil #0)</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
