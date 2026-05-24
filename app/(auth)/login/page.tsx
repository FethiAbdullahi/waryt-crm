import { LoginForm } from "./login-form";

function safeNextPath(next: string | undefined): string {
  if (!next || typeof next !== "string") return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

type PageProps = {
  searchParams?: Promise<{ next?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const next = safeNextPath(sp.next);
  const initialError =
    sp.error === "forbidden" || sp.error === "auth" ? sp.error : undefined;

  return <LoginForm next={next} initialError={initialError} />;
}
