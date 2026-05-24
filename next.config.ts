import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "path";
import { fileURLToPath } from "url";
import {
  hydrateEnvLocalFromDir,
  loadSupabasePublicIntoProcess,
} from "./lib/env/hydrate-env-local";

// Pin Turbopack to this app folder so a parent `package-lock.json` does not steal the workspace root.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

// Load `.env.local` from the directory that contains this config file, then the
// same discovery used at runtime (cwd / INIT_CWD / walk from bundled chunks).
hydrateEnvLocalFromDir(projectRoot);
loadSupabasePublicIntoProcess();

const supabasePublicEnv: Record<string, string> = {};
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
if (url) supabasePublicEnv.NEXT_PUBLIC_SUPABASE_URL = url;
if (anon) supabasePublicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY = anon;

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@wrksz/themes"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  turbopack: {
    root: projectRoot,
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  async redirects() {
    return [{ source: "/challenges", destination: "/sales?tab=field", permanent: false }];
  },
  async rewrites() {
    return [{ source: "/reports", destination: "/?app=reports" }];
  },
  ...(Object.keys(supabasePublicEnv).length > 0
    ? { env: supabasePublicEnv }
    : {}),
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
