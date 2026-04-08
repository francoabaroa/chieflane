const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});

function toValidDate(dateLike: string | number | Date): Date | null {
  const date =
    dateLike instanceof Date ? dateLike : new Date(dateLike);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatRelativeTime(dateLike: string | number | Date): string {
  const date = toValidDate(dateLike);
  if (!date) {
    return "unknown time";
  }

  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const ranges: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
    ["second", 1],
  ];

  for (const [unit, size] of ranges) {
    if (Math.abs(seconds) >= size || unit === "second") {
      return relativeTimeFormatter.format(
        Math.round(seconds / size),
        unit
      );
    }
  }

  return "just now";
}

export function formatDateTime(
  dateLike: string | number | Date,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }
): string {
  const date = toValidDate(dateLike);
  if (!date) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat(undefined, options).format(date);
}

export function isValidEmail(value: unknown): boolean {
  return (
    typeof value === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  );
}

const SAFE_EXTERNAL_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

export function getSafeExternalHref(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    return SAFE_EXTERNAL_PROTOCOLS.has(url.protocol.toLowerCase())
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
