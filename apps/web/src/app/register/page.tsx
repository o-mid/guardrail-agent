"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { saveTokens } from "@/lib/session";

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
        body: JSON.stringify({ email: email.trim(), password }),
      });
      saveTokens(data.accessToken, data.refreshToken);
      router.push("/app/compose");
    } catch (err) {
      setError(err instanceof Error ? err.message : "register_failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col justify-center px-4 py-12 sm:px-6">
      <div className="mx-auto w-full max-w-md motion-safe:animate-mark-fade-in">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <BrandMark size="sm" />
          <span className="text-sm font-semibold">Guardrail Agent</span>
        </Link>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight">Register</h1>
        <p className="mt-2 text-sm text-muted-foreground">Local accounts only. Not a production identity.</p>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Create account</CardTitle>
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
                <Label htmlFor="password">Password (min 8 characters)</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
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
                {loading ? "Creating…" : "Create account"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-4 text-sm text-muted-foreground">
          Already registered?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
