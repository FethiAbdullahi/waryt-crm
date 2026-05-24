"use client";

import { NextIntlClientProvider } from "next-intl";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/query-provider";
import { PwaRegister } from "@/components/pwa-register";
import { PwaInstallProvider } from "@/components/pwa-install-provider";

export function Providers({
  children,
  locale,
  messages,
}: {
  children: React.ReactNode;
  locale: string;
  messages: import("next-intl").AbstractIntlMessages;
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryProvider>
        <PwaInstallProvider>
          <PwaRegister />
          {children}
        </PwaInstallProvider>
        <Toaster richColors closeButton position="top-center" />
      </QueryProvider>
    </NextIntlClientProvider>
  );
}
