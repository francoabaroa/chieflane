"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/auth/login?next=${encodeURIComponent(nextPath)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        }
      );

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        redirectTo?: string;
      };

      if (!response.ok || payload.ok === false) {
        setError(payload.error ?? "Unable to sign in");
        return;
      }

      router.replace(payload.redirectTo ?? "/today");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
      <label className="block space-y-2">
        <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-text-tertiary font-[family-name:var(--font-mono)]">
          Password
        </span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full border border-border bg-base px-3 py-2.5 text-[0.875rem] text-text-primary outline-none transition-colors focus:border-accent"
        />
      </label>

      <button
        type="submit"
        disabled={busy || password.length === 0}
        className="inline-flex w-full items-center justify-center bg-accent px-4 py-2.5 text-[0.875rem] font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Signing in..." : "Sign in"}
      </button>

      <p aria-live="polite" className="min-h-5 text-[0.8125rem] text-critical">
        {error}
      </p>
    </form>
  );
}
