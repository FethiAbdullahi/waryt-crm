import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SUPABASE_FORCE = new Set([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
]);

const URL_NP = "NEXT_PUBLIC_SUPABASE_URL";
const KEY_NP = "NEXT_PUBLIC_SUPABASE_ANON_KEY";
const URL_S = "SUPABASE_URL";
const KEY_S = "SUPABASE_ANON_KEY";

/** Strip quotes; remove trailing `# comment` only (avoids breaking JWTs). */
function stripValue(raw: string) {
  let v = raw.trim().replace(/^\uFEFF/, "");
  v = v.replace(/\s+#.*$/, "");
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

function readTextFileRobust(filePath: string): string {
  const buf = readFileSync(filePath);
  if (buf.length === 0) return "";
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.subarray(2).toString("utf16le");
  }
  let s = buf.toString("utf8");
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  return s;
}

function assignmentsFromLine(line: string): { key: string; value: string }[] {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return [];
  const re = /\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*/g;
  const hits: { key: string; valueStart: number; keyStart: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(trimmed)) !== null) {
    hits.push({ key: m[1], valueStart: m.index + m[0].length, keyStart: m.index });
  }
  if (hits.length === 0) return [];
  const pairs: { key: string; value: string }[] = [];
  for (let i = 0; i < hits.length; i += 1) {
    const end = i + 1 < hits.length ? hits[i + 1].keyStart : trimmed.length;
    pairs.push({
      key: hits[i].key,
      value: stripValue(trimmed.slice(hits[i].valueStart, end)),
    });
  }
  return pairs;
}

/** Prefix parse per line (handles invisible chars before key). */
export function readLooseSupabaseKeysFromFile(filePath: string): {
  url: string;
  key: string;
} {
  if (!existsSync(filePath)) return { url: "", key: "" };
  let urlNp = "";
  let keyNp = "";
  let urlS = "";
  let keyS = "";
  try {
    const text = readTextFileRobust(filePath);
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.replace(/^\uFEFF/, "").replace(/^[\u200B-\u200D\uFEFF]+/, "");
      const t = line.trimStart();
      const pUrlNp = `${URL_NP}=`;
      const pKeyNp = `${KEY_NP}=`;
      const pUrlS = `${URL_S}=`;
      const pKeyS = `${KEY_S}=`;
      if (t.startsWith(pUrlNp)) urlNp = stripValue(t.slice(pUrlNp.length));
      else if (t.startsWith(pKeyNp)) keyNp = stripValue(t.slice(pKeyNp.length));
      else if (t.startsWith(pUrlS)) urlS = stripValue(t.slice(pUrlS.length));
      else if (t.startsWith(pKeyS)) keyS = stripValue(t.slice(pKeyS.length));
    }
  } catch {
    return { url: "", key: "" };
  }
  const url = urlS || urlNp;
  const key = keyS || keyNp;
  return { url, key };
}

function uniqueStrings(paths: (string | undefined)[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of paths) {
    if (!p) continue;
    const n = resolve(p);
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function walkAncestors(start: string, maxDepth: number) {
  const dirs: string[] = [];
  let dir = resolve(start);
  for (let i = 0; i < maxDepth; i += 1) {
    dirs.push(dir);
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dirs;
}

export function findDirWithSupabaseDotLocal(): string | null {
  let moduleDir: string | undefined;
  try {
    moduleDir = dirname(fileURLToPath(import.meta.url));
  } catch {
    moduleDir = undefined;
  }

  const seeds = uniqueStrings([
    process.cwd(),
    process.env.INIT_CWD,
    moduleDir,
  ]);

  for (const seed of seeds) {
    for (const dir of walkAncestors(seed, 50)) {
      const envPath = join(dir, ".env.local");
      if (!existsSync(envPath)) continue;
      const { url, key } = readLooseSupabaseKeysFromFile(envPath);
      if (url && key) return dir;
    }
  }
  return null;
}

export function hydrateEnvLocalFromDir(projectRoot: string): void {
  const filePath = join(projectRoot, ".env.local");
  if (!existsSync(filePath)) return;
  let content: string;
  try {
    content = readTextFileRobust(filePath);
  } catch {
    return;
  }
  for (const line of content.split(/\r?\n/)) {
    for (const { key, value } of assignmentsFromLine(line)) {
      if (!key) continue;
      if (SUPABASE_FORCE.has(key)) {
        if (value) process.env[key] = value;
        continue;
      }
      const cur = process.env[key];
      if (cur === undefined || String(cur).trim() === "") {
        process.env[key] = value;
      }
    }
  }
  const u =
    process.env[URL_S]?.trim() ||
    process.env[URL_NP]?.trim();
  const k =
    process.env[KEY_S]?.trim() ||
    process.env[KEY_NP]?.trim();
  if (u && !process.env[URL_S]?.trim()) process.env[URL_S] = u;
  if (k && !process.env[KEY_S]?.trim()) process.env[KEY_S] = k;
  if (u && !process.env[URL_NP]?.trim()) process.env[URL_NP] = u;
  if (k && !process.env[KEY_NP]?.trim()) process.env[KEY_NP] = k;
}

export function readSupabasePublicDirectFromDisk(): { url: string; key: string } {
  const root = findDirWithSupabaseDotLocal();
  if (!root) return { url: "", key: "" };
  return readLooseSupabaseKeysFromFile(join(root, ".env.local"));
}

export function loadSupabasePublicIntoProcess(): void {
  if (typeof window !== "undefined") return;
  if (process.env.NEXT_RUNTIME === "edge") return;

  const has = () => {
    const { url, key } = readLooseFromProcess();
    return Boolean(url?.trim() && key?.trim());
  };
  if (has()) return;

  const root = findDirWithSupabaseDotLocal();
  if (root) {
    hydrateEnvLocalFromDir(root);
    const { url, key } = readLooseSupabaseKeysFromFile(join(root, ".env.local"));
    if (url) {
      process.env[URL_NP] = url;
      process.env[URL_S] = url;
    }
    if (key) {
      process.env[KEY_NP] = key;
      process.env[KEY_S] = key;
    }
  }
}

function readLooseFromProcess(): { url: string; key: string } {
  const url =
    process.env[URL_S]?.trim() ||
    process.env[URL_NP]?.trim() ||
    "";
  const key =
    process.env[KEY_S]?.trim() ||
    process.env[KEY_NP]?.trim() ||
    "";
  return { url, key };
}
