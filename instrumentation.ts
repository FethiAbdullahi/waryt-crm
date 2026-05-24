/**
 * Next.js expects this file when the dev cache references it.
 * Env is loaded from `next.config.ts` + `lib/env/hydrate-env-local.ts` at runtime.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
}
