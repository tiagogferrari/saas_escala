export const defaultTheme = {
  color: {
    brand: "#2563eb",
    surface: "#ffffff",
    text: "#111827",
    muted: "#6b7280",
    border: "#e5e7eb",
    success: "#15803d",
    warning: "#b45309",
    danger: "#b91c1c",
  },
  radius: {
    control: "0.75rem",
    card: "1rem",
  },
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
  },
} as const;

export type EscalaTheme = typeof defaultTheme;
