export function getSafePostLoginRedirect(nextParam: unknown): string {
  if (typeof nextParam !== "string") {
    return "/today";
  }

  const redirectTarget = nextParam.trim();
  return redirectTarget.startsWith("/") && !redirectTarget.startsWith("//")
    ? redirectTarget
    : "/today";
}
