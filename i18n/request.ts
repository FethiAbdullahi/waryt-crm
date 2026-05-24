import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { routing, type AppLocale } from "./routing";

const modules = [
  "roles",
  "nav",
  "shell",
  "auth",
  "onboarding",
  "validation",
  "toasts",
  "errors",
  "common",
  "studioEnum",
  "studioWorkspace",
  "studioPanels",
  "studioPipeline",
  "dashboard",
  "admin",
  "settings",
  "teams",
  "interactions",
  "satisfaction",
] as const;

async function loadMessages(locale: AppLocale) {
  const out: Record<string, unknown> = {};
  for (const name of modules) {
    const mod = (await import(`../messages/${locale}/${name}.json`)).default as Record<
      string,
      unknown
    >;
    Object.assign(out, mod);
  }
  return out;
}

export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get("NEXT_LOCALE")?.value;
  const locale: AppLocale = routing.locales.includes(raw as AppLocale)
    ? (raw as AppLocale)
    : routing.defaultLocale;

  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: "Africa/Addis_Ababa",
    onError(error) {
      if (error.code === "MISSING_MESSAGE") {
        console.warn(error.message);
      }
    },
  };
});
