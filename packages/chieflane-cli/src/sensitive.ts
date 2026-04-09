const SENSITIVE_PATTERN = /(secret|token|api[-_]?key|password)/i;

export function isSensitiveConfigPath(configPath: string) {
  return SENSITIVE_PATTERN.test(configPath);
}

export function redactValue(value: unknown) {
  if (value == null) {
    return value;
  }

  return "[REDACTED]";
}
