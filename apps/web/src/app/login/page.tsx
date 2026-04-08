import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextPath = next?.startsWith("/") ? next : "/today";

  return (
    <main className="flex min-h-screen items-center justify-center bg-base px-4">
      <div className="w-full max-w-sm">
        <p className="text-[0.6875rem] uppercase tracking-[0.2em] text-text-tertiary font-[family-name:var(--font-mono)]">
          Chieflane
        </p>
        <h1 className="mt-3 text-[2rem] text-text-primary font-[family-name:var(--font-display)] leading-none">
          Operator Login
        </h1>
        <p className="mt-2 text-[0.8125rem] leading-relaxed text-text-secondary max-w-[40ch]">
          Sign in to access the shell.
        </p>

        <LoginForm nextPath={nextPath} />
      </div>
    </main>
  );
}
