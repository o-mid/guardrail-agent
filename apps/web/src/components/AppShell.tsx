"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ActivityIcon, AppMenuIcon, LogoutIcon, TerminalIcon } from "@/components/icons";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarItem,
} from "@/components/ui/sidebar";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { api } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/session";

type User = { id: string; email: string };

const nav = [
  { href: "/app/compose", label: "Compose", icon: TerminalIcon },
  { href: "/app/audit", label: "Audit", icon: ActivityIcon },
];

function NavItems({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  return (
    <SidebarGroup>
      {nav.map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <SidebarItem
            key={item.href}
            active={active}
            icon={<Icon className="size-4" />}
            aria-current={active ? "page" : undefined}
            onClick={() => {
              router.push(item.href);
              onNavigate?.();
            }}
          >
            {item.label}
          </SidebarItem>
        );
      })}
    </SidebarGroup>
  );
}

function ShellChrome({
  user,
  pathname,
  onLogout,
  onNavigate,
}: {
  user: User | null;
  pathname: string;
  onLogout: () => void;
  onNavigate?: () => void;
}) {
  return (
    <>
      <SidebarHeader>
        <Link href="/app/compose" className="flex min-w-0 items-center gap-2.5" onClick={onNavigate}>
          <BrandMark size="sm" />
          <span className="truncate text-sm font-semibold tracking-tight">Guardrail</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <NavItems pathname={pathname} onNavigate={onNavigate} />
      </SidebarContent>
      <SidebarFooter className="space-y-3">
        <StatusIndicator status="away" label="Local Anvil + Solana" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          PLANNER=mock by default. OpenAI fails closed. No mainnet.
        </p>
        <Separator />
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground">
            {user ? user.email : "Loading…"}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onLogout}
            aria-label="Log out"
          >
            <LogoutIcon className="size-4" />
          </Button>
        </div>
      </SidebarFooter>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

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
    <div className="flex min-h-screen">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Sidebar className="sticky top-0 hidden h-svh md:flex" aria-label="Main">
        <ShellChrome user={user} pathname={pathname} onLogout={logout} />
      </Sidebar>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-sm md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <AppMenuIcon className="size-4" />
            </Button>
            <SheetContent side="left" className="w-64 p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <Sidebar className="h-full w-full border-0 shadow-none">
                <ShellChrome
                  user={user}
                  pathname={pathname}
                  onLogout={logout}
                  onNavigate={() => setMobileOpen(false)}
                />
              </Sidebar>
            </SheetContent>
          </Sheet>
          <Link href="/app/compose" className="flex items-center gap-2 font-semibold">
            <BrandMark size="sm" />
            Guardrail
          </Link>
        </header>
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 pb-24 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
