export const AUTH_COOKIE_NAME = "chieflane_session";

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export function isAppAuthEnabled() {
  return Boolean(process.env.SHELL_APP_PASSWORD);
}

export function createSessionToken() {
  return (
    process.env.SHELL_APP_SESSION_SECRET ??
    `chieflane:${process.env.SHELL_APP_PASSWORD ?? ""}:session`
  );
}

export function isValidSessionToken(value: string | undefined) {
  if (!value || !isAppAuthEnabled()) {
    return false;
  }

  return value === createSessionToken();
}
