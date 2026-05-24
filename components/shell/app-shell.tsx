"use client";

import type { User } from "@supabase/supabase-js";
import { ArrowLeft, Menu, Moon, PanelLeftClose, PanelLeftOpen, Plus, Settings, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, startTransition } from "react";
import { useShellTheme } from "@/hooks/use-shell-theme";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { navForRole, type NavItem } from "@/lib/nav";
import { useHubViewStore, type HubView } from "@/lib/stores/hub-view-store";
import type { Profile, UserRole } from "@/lib/types";
import { parseDisplayCurrencyFromProfile, useDisplayCurrencyStore } from "@/lib/display-currency-store";
import { useUiStore } from "@/lib/stores/ui-store";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useRoleLabel } from "@/hooks/use-role-label";
import { WarytLogo } from "@/components/brand/waryt-logo";
import { GlobalSearch } from "@/components/shell/global-search";
import { LanguageSwitcher } from "@/components/shell/language-switcher";
import { NotificationsMenu } from "@/components/shell/notifications-menu";
import { HelpToolkitPopover } from "@/components/onboarding/help-toolkit-popover";
import { QuickAddSaleDialog } from "@/components/shell/quick-add-sale-dialog";
import { CustomerSatisfactionDialog } from "@/components/shell/customer-satisfaction-dialog";
import { PwaInstallFloating } from "@/components/pwa-install-floating";
import { useNotificationsRealtime } from "@/hooks/use-notifications-realtime";
import { useSalesRealtime } from "@/hooks/use-sales-realtime";

const supabase = createBrowserSupabaseClient();

type Membership = {
  team_id: string;
  is_primary: boolean;
  member_role: "manager" | "agent";
};

function navHrefToHubView(href: string): HubView | null {
  if (href === "/") return "home";
  if (href === "/reports") return "reports";
  return null;
}

function ShellNavLinks({
  items,
  pathname,
  onNavigate,
  hubNavigate,
  role,
  blockedReportsMessage,
  navLabel,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
  hubNavigate: (path: string) => void;
  role: UserRole;
  blockedReportsMessage: string;
  navLabel: (key: NavItem["labelKey"]) => string;
}) {
  const hubView = useHubViewStore((s) => s.view);
  const onHubSurface = pathname === "/" || pathname.startsWith("/reports");

  return (
    <nav className="flex flex-col gap-1.5">
      {items.map((item) => {
        const Icon = item.icon;
        const hub = item.hubSpa ? navHrefToHubView(item.href) : null;

        if (hub) {
          const active = onHubSurface && hubView === hub;
          return (
            <button
              key={item.href}
              type="button"
              onClick={() => {
                onNavigate?.();
                useHubViewStore
                  .getState()
                  .goHubView(hub, role, hubNavigate, { blockedReportsMessage });
              }}
              className={cn(
                "group relative flex w-full items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors duration-150 ease-out",
                active
                  ? "bg-primary/12 text-primary shadow-sm ring-1 ring-primary/15"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
              )}
            >
              {active ? (
                <span
                  className="bg-primary absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-full"
                  aria-hidden
                />
              ) : null}
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                  active
                    ? "bg-primary/15 text-primary"
                    : "bg-sidebar-accent/40 text-muted-foreground group-hover:bg-sidebar-accent group-hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 truncate">{navLabel(item.labelKey)}</span>
            </button>
          );
        }

        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            scroll={false}
            onClick={onNavigate}
            className={cn(
              "group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 ease-out",
              active
                ? "bg-primary/12 text-primary shadow-sm ring-1 ring-primary/15"
                : "text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
            )}
          >
            {active ? (
              <span
                className="bg-primary absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-full"
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                active
                  ? "bg-primary/15 text-primary"
                  : "bg-sidebar-accent/40 text-muted-foreground group-hover:bg-sidebar-accent group-hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 truncate">{navLabel(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  user,
  profile,
  memberships,
  children,
}: {
  user: User;
  profile: Profile;
  memberships: Membership[];
  children: React.ReactNode;
}) {
  const tShell = useTranslations("shell");
  const tNav = useTranslations("nav");
  const tRoles = useTranslations("roles");
  const tErrors = useTranslations("errors");
  const roleLabel = useRoleLabel();
  const navLabel = useCallback((k: NavItem["labelKey"]) => tNav(k), [tNav]);
  const blockedReportsMessage = tErrors("noReportsAccess");

  const pathname = usePathname();
  const router = useRouter();
  const showBack = Boolean(pathname) && pathname !== "/" && !pathname.startsWith("/login");
  const { resolvedTheme, setTheme } = useShellTheme();
  const setQuickAddOpen = useUiStore((s) => s.setQuickAddOpen);
  const sidebarHidden = useUiStore((s) => s.sidebarHidden);
  const setSidebarHidden = useUiStore((s) => s.setSidebarHidden);
  const [mobileOpen, setMobileOpen] = useState(false);
  const setDisplayCurrency = useDisplayCurrencyStore((s) => s.setCurrency);

  const role = profile.role;

  useEffect(() => {
    setDisplayCurrency(parseDisplayCurrencyFromProfile(profile));
  }, [profile, setDisplayCurrency]);

  const teamIds = useMemo(() => memberships.map((m) => m.team_id), [memberships]);

  useSalesRealtime(supabase, { teamIds, userId: user.id });
  useNotificationsRealtime(supabase, user.id);

  const items = useMemo(() => navForRole(role), [role]);

  const hubNavigate = useCallback(
    (path: string) => {
      startTransition(() => {
        router.push(path, { scroll: false });
      });
    },
    [router],
  );

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("waryt:open-search"));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="from-[color-mix(in_srgb,var(--background)_92%,var(--primary)_8%)] via-background to-[color-mix(in_srgb,var(--muted)_75%,var(--background))] relative min-h-dvh bg-gradient-to-br">
      <div className="md:flex">
        <aside
          className={cn(
            "from-[color-mix(in_srgb,var(--sidebar)_88%,var(--primary)_12%)] via-sidebar to-[color-mix(in_srgb,var(--sidebar)_75%,var(--muted)_25%)] text-sidebar-foreground border-sidebar-border sticky top-0 hidden h-dvh w-[17rem] shrink-0 border-r bg-gradient-to-b shadow-[4px_0_28px_-10px_rgba(90,50,20,0.12)] dark:shadow-[4px_0_28px_-6px_rgba(0,0,0,0.45)]",
            !sidebarHidden && "md:block",
          )}
        >
          <div className="flex h-full flex-col gap-5 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-2.5">
                <WarytLogo variant="sidebar" priority />
                <div className="text-muted-foreground text-sm">{tShell("productName")}</div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-sidebar-foreground size-9 shrink-0 rounded-xl"
                onClick={() => setSidebarHidden(true)}
                aria-label={tShell("hideSidebar")}
              >
                <PanelLeftClose className="size-4" />
              </Button>
            </div>
            <ShellNavLinks
              items={items}
              pathname={pathname ?? ""}
              role={role}
              hubNavigate={hubNavigate}
              blockedReportsMessage={blockedReportsMessage}
              navLabel={navLabel}
            />
            <div className="mt-auto space-y-2">
              <Separator />
              <div className="text-muted-foreground text-xs">
                {tShell("signedInAs")}{" "}
                <span className="text-sidebar-foreground font-medium">
                  {profile.display_name}
                </span>
              </div>
              <div className="text-muted-foreground text-[11px] uppercase">
                {tRoles("roleLabel")}: {roleLabel(role)}
              </div>
              <Button variant="outline" className="w-full rounded-xl" onClick={signOut}>
                {tShell("signOut")}
              </Button>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-border/50 bg-background/80 shadow-[0_1px_0_rgba(0,60,140,0.06)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/65 dark:shadow-[0_1px_0_rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-2 px-3 py-3 sm:px-4 md:px-6 lg:px-8 xl:px-10 2xl:px-12">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger
                  className={cn(
                    buttonVariants({ variant: "outline", size: "icon" }),
                    "md:hidden rounded-xl",
                  )}
                >
                  <Menu className="size-4" />
                </SheetTrigger>
                <SheetContent side="left" className="flex h-dvh w-72 flex-col">
                  <SheetHeader className="text-center">
                    <WarytLogo variant="sheet" />
                    <SheetTitle className="sr-only">{tShell("menuTitle")}</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
                    <ShellNavLinks
                      items={items}
                      pathname={pathname ?? ""}
                      role={role}
                      hubNavigate={hubNavigate}
                      blockedReportsMessage={blockedReportsMessage}
                      navLabel={navLabel}
                      onNavigate={() => setMobileOpen(false)}
                    />
                  </div>
                  <div className="mt-6 space-y-2 border-t border-border/60 pt-4">
                    <div className="text-muted-foreground text-xs">
                      {tShell("signedInAs")}{" "}
                      <span className="text-foreground font-medium">{profile.display_name}</span>
                    </div>
                    <div className="text-muted-foreground text-[11px] uppercase">
                      {tRoles("roleLabel")}: {roleLabel(role)}
                    </div>
                    <Button
                      variant="outline"
                      className="w-full rounded-xl"
                      onClick={() => {
                        setMobileOpen(false);
                        void signOut();
                      }}
                    >
                      {tShell("signOut")}
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>

              {showBack ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 rounded-xl"
                  aria-label={tShell("goBack")}
                  onClick={() => router.back()}
                >
                  <ArrowLeft className="size-4" />
                </Button>
              ) : null}

              {sidebarHidden ? (
                <div className="mr-1 hidden shrink-0 items-center gap-2 md:flex">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="rounded-xl"
                    onClick={() => setSidebarHidden(false)}
                    aria-label={tShell("showSidebar")}
                  >
                    <PanelLeftOpen className="size-4" />
                  </Button>
                  <Link
                    href="/"
                    prefetch
                    scroll={false}
                    className="text-foreground hover:bg-muted/60 flex min-w-0 max-w-[min(100%,14rem)] items-center gap-2 rounded-xl py-1 pr-2 pl-1 transition-colors lg:max-w-[18rem]"
                    title={tShell("homeTitle")}
                  >
                    <WarytLogo
                      variant="sidebar"
                      priority={false}
                      className="h-7 w-auto max-w-[5.5rem] shrink-0 object-contain object-left md:h-8 md:max-w-[6.5rem]"
                    />
                    <span className="truncate text-left text-sm font-semibold tracking-tight">
                      {tShell("productName")}
                    </span>
                  </Link>
                </div>
              ) : null}

              <div className="flex min-w-0 flex-1 items-center gap-2">
                <GlobalSearch />
              </div>

              <HelpToolkitPopover triggerClassName="hidden md:inline-flex" />
              <HelpToolkitPopover triggerClassName="md:hidden" />

              <LanguageSwitcher />

              <Button
                variant="outline"
                size="icon"
                className="rounded-xl"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                aria-label={tShell("toggleTheme")}
              >
                <Sun className="hidden size-4 dark:inline" />
                <Moon className="inline size-4 dark:hidden" />
              </Button>

              <NotificationsMenu userId={user.id} />

              <Link
                href="/settings"
                prefetch
                aria-label={tShell("settings")}
                className={cn(
                  buttonVariants({ variant: "outline", size: "icon" }),
                  "rounded-xl",
                )}
              >
                <Settings className="size-4" />
              </Link>
            </div>
          </header>

          <main className="w-full max-w-none px-3 py-5 pb-36 transition-[color,background-color] duration-200 sm:px-4 md:px-6 md:py-7 md:pb-40 lg:px-8 xl:px-10 2xl:px-12">
            {children}
          </main>
        </div>
      </div>

      <div className="fixed bottom-5 right-3 z-40 flex flex-col items-end gap-2 sm:bottom-6 sm:right-4 md:right-6 lg:right-8">
        <PwaInstallFloating />
        <Button
          type="button"
          className="h-12 gap-1.5 rounded-full border-0 bg-primary px-4 text-sm font-bold tracking-tight text-primary-foreground shadow-[0_14px_36px_-10px_rgba(120,50,20,0.45)] transition-transform hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] sm:h-14 sm:gap-2 sm:px-5 sm:text-base"
          size="lg"
          onClick={() => setQuickAddOpen(true)}
          aria-label={tShell("quickAddSale")}
        >
          <Plus className="size-4 shrink-0 stroke-[2.5] sm:size-5" />
          <span className="sm:hidden">{tShell("addSale")}</span>
          <span className="hidden sm:inline">{tShell("quickAddSale")}</span>
        </Button>
      </div>

      <QuickAddSaleDialog userId={user.id} />
      <CustomerSatisfactionDialog userId={user.id} />
    </div>
  );
}
