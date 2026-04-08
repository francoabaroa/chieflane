/**
 * Chieflane Design System Tokens
 *
 * Shared design tokens for web and native renderers.
 * The web app uses these via Tailwind CSS custom properties.
 * The native app will use them as React Native style constants.
 */

export const colors = {
  base: "#0C0C14",
  surface: "#141420",
  surfaceHover: "#1A1A2E",
  elevated: "#1E1E30",
  border: "#252538",
  borderSubtle: "#1C1C2E",
  accent: "#D4A574",
  accentHover: "#E8BA89",
  accentMuted: "rgba(212, 165, 116, 0.15)",
  textPrimary: "#E8E4DF",
  textSecondary: "#8A8598",
  textTertiary: "#5A5568",
  success: "#5CB690",
  successMuted: "rgba(92, 182, 144, 0.12)",
  warning: "#E8B44E",
  warningMuted: "rgba(232, 180, 78, 0.12)",
  critical: "#E06C6C",
  criticalMuted: "rgba(224, 108, 108, 0.12)",
  info: "#6C9FE0",
  infoMuted: "rgba(108, 159, 224, 0.12)",
} as const;

export const fonts = {
  display: '"Instrument Serif", serif',
  body: '"Plus Jakarta Sans", system-ui, sans-serif',
  mono: '"JetBrains Mono", monospace',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
} as const;

export const radii = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const toneColors = {
  neutral: { bg: colors.surface, text: colors.textSecondary, border: colors.border },
  good: { bg: colors.successMuted, text: colors.success, border: "rgba(92, 182, 144, 0.3)" },
  warn: { bg: colors.warningMuted, text: colors.warning, border: "rgba(232, 180, 78, 0.3)" },
  critical: { bg: colors.criticalMuted, text: colors.critical, border: "rgba(224, 108, 108, 0.3)" },
} as const;

export const statusColors = {
  queued: { bg: colors.infoMuted, text: colors.info },
  ready: { bg: colors.successMuted, text: colors.success },
  awaiting_review: { bg: colors.warningMuted, text: colors.warning },
  blocked: { bg: colors.criticalMuted, text: colors.critical },
  done: { bg: colors.successMuted, text: colors.success },
  archived: { bg: colors.surface, text: colors.textTertiary },
} as const;
