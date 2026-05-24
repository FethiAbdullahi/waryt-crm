/**
 * Optional Google sign-in allowlist. When unset or empty, any Google account is allowed.
 * Set `NEXT_PUBLIC_WARYT_ALLOWED_EMAIL_DOMAINS` to comma-separated domains (e.g. `waryt.com,example.org`)
 * or `NEXT_PUBLIC_WARYT_ALLOWED_EMAILS` for explicit addresses.
 */
function parseList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const ALLOWED_EMAILS = new Set(
  parseList(process.env.NEXT_PUBLIC_WARYT_ALLOWED_EMAILS),
);

const ALLOWED_DOMAINS = parseList(process.env.NEXT_PUBLIC_WARYT_ALLOWED_EMAIL_DOMAINS).map((d) =>
  d.startsWith("@") ? d.slice(1) : d,
);

export function isWarytGoogleEmailAllowed(email: string | undefined | null): boolean {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  if (ALLOWED_EMAILS.size === 0 && ALLOWED_DOMAINS.length === 0) return true;
  if (ALLOWED_EMAILS.has(lower)) return true;
  const at = lower.lastIndexOf("@");
  if (at === -1) return false;
  const domain = lower.slice(at + 1);
  return ALLOWED_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}
