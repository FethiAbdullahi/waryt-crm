import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import { getMessages, getLocale } from "next-intl/server";
import { getTheme } from "@wrksz/themes/next";
import "./globals.css";
import { AppThemeProvider } from "@/components/app-theme-provider";
import { Providers } from "@/components/providers";

/** UI body: Plus Jakarta Sans. Headings: Outfit (distinctive, product-grade). */
const plusJakarta = Plus_Jakarta_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const outfit = Outfit({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Waryt CRM — B2B sales workspace",
  description:
    "Waryt CRM: pipeline, accounts, performance, and renewals for modern sales teams.",
  appleWebApp: {
    capable: true,
    title: "Waryt CRM",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/warretlogo.ico", sizes: "any" }],
    apple: "/warretlogo.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const fontVars = `${plusJakarta.variable} ${outfit.variable}`;
  const initialTheme = await getTheme({ defaultTheme: "system", storageKey: "theme" });
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={fontVars} suppressHydrationWarning>
      <body className="font-sans min-h-dvh bg-background text-foreground antialiased">
        <AppThemeProvider initialTheme={initialTheme}>
          <Providers locale={locale} messages={messages}>
            {children}
          </Providers>
        </AppThemeProvider>
      </body>
    </html>
  );
}
