export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#faf7fb]">
      <div
        className="pointer-events-none absolute -left-32 top-0 h-[420px] w-[420px] rounded-full bg-[#eb2d8f]/15 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-24 bottom-0 h-[380px] w-[380px] rounded-full bg-[#f2693b]/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 h-64 w-[min(90%,48rem)] -translate-x-1/2 rounded-full bg-primary/5 blur-2xl"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center p-4 text-center sm:p-8">
        {children}
      </div>
    </div>
  );
}
