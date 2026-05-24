"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { WarytLogo } from "@/components/brand/waryt-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { getSupabasePublicEnv } from "@/lib/supabase/public-env";

function safeNextPath(next: string): string {
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

function callbackOrigin(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

export function LoginForm({
  next: nextProp,
  initialError,
}: {
  next: string;
  initialError?: string;
}) {
  const t = useTranslations("auth");
  const tErr = useTranslations("errors");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const next = safeNextPath(nextProp);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const authErrorToastShown = useRef(false);

  const redirectTo = useMemo(() => `${callbackOrigin()}/auth/callback`, []);
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  useEffect(() => {
    if (authErrorToastShown.current || !initialError) return;
    authErrorToastShown.current = true;
    if (initialError === "forbidden") {
      toast.error(tErr("forbiddenGoogle"), { description: tErr("forbiddenGoogleDescription") });
    } else if (initialError === "auth") {
      toast.error(tErr("genericAuth"));
    }
    const qs = new URLSearchParams();
    if (next !== "/") qs.set("next", next);
    const path = qs.toString() ? `/login?${qs.toString()}` : "/login";
    router.replace(path);
  }, [initialError, next, router, tErr]);

  function googleSignIn() {
    setLoading(true);
    window.location.assign("/auth/google");
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error(t("invalidEmail"));
      return;
    }
    const { url: sbUrl, key: sbKey } = getSupabasePublicEnv();
    if (!sbUrl || !sbKey) {
      toast.error(t("magicLinkConfigError"), { description: t("magicLinkNetworkHint") });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setMagicSent(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const looksLikeNetwork =
        /failed to fetch|networkerror|load failed|fetch/i.test(msg);
      toast.error(
        looksLikeNetwork ? t("magicLinkNetworkError") : t("magicLinkUnexpectedError"),
        { description: looksLikeNetwork ? t("magicLinkNetworkHint") : undefined },
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md overflow-hidden rounded-3xl border-0 bg-card/85 text-center shadow-[0_24px_80px_-20px_rgba(11,95,255,0.28)] ring-1 ring-black/[0.04] backdrop-blur-xl dark:bg-card/80 dark:ring-white/10">
      <CardHeader className="flex flex-col items-center space-y-4 pb-2 pt-8 text-center">
        <WarytLogo variant="auth" priority />
        <div className="mx-auto max-w-sm space-y-2">
          <p className="text-muted-foreground font-heading text-xs font-semibold uppercase tracking-[0.2em]">
            {t("productLine")}
          </p>
          <CardTitle className="font-heading text-3xl font-bold tracking-tight text-foreground">
            {t("welcomeBack")}
          </CardTitle>
          <CardDescription className="text-center text-base leading-relaxed">
            {t("subtitle")}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-6 px-6 pb-8 sm:px-8">
        <Button
          type="button"
          className="h-14 w-full max-w-sm rounded-2xl text-base font-semibold shadow-md shadow-primary/25 transition-transform hover:scale-[1.01] active:scale-[0.99]"
          size="lg"
          disabled={loading}
          onClick={googleSignIn}
        >
          {loading && !magicSent ? t("redirectingGoogle") : t("continueGoogle")}
        </Button>

        <div className="relative w-full max-w-sm">
          <div className="absolute inset-x-6 -top-3 flex items-center">
            <span className="bg-card text-muted-foreground w-full border-t border-dashed" />
            <span className="text-muted-foreground bg-card px-2 text-xs font-medium uppercase tracking-wide">
              {tCommon("or")}
            </span>
            <span className="bg-card text-muted-foreground w-full border-t border-dashed" />
          </div>
        </div>

        {magicSent ? (
          <div className="w-full max-w-sm space-y-2 rounded-2xl border border-border/80 bg-muted/30 px-4 py-4 text-left">
            <p className="text-foreground text-sm font-semibold">{t("magicSentTitle")}</p>
            <p className="text-muted-foreground text-sm leading-relaxed">{t("magicSentBody")}</p>
          </div>
        ) : (
          <form onSubmit={sendMagicLink} className="w-full max-w-sm space-y-3 text-left">
            <div className="space-y-2">
              <Label htmlFor="magic-email">{t("magicHeading")}</Label>
              <p className="text-muted-foreground text-xs">{t("magicDescription")}</p>
              <Input
                id="magic-email"
                type="email"
                autoComplete="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl"
                disabled={loading}
              />
            </div>
            <Button
              type="submit"
              variant="secondary"
              className="h-12 w-full rounded-2xl font-semibold"
              disabled={loading}
            >
              {loading ? t("sendingMagic") : t("sendMagicLink")}
            </Button>
          </form>
        )}

        <div className="w-full max-w-sm rounded-2xl border border-dashed border-border/80 bg-muted/30 px-4 py-3 text-center">
          <p className="text-muted-foreground text-xs leading-relaxed">{t("legalNotice")}</p>
        </div>
      </CardContent>
    </Card>
  );
}
