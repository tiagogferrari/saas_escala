import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary";
};

export function Button({
  children,
  variant = "primary",
  style,
  ...props
}: ButtonProps) {
  const isPrimary = variant === "primary";

  return (
    <button
      {...props}
      style={{
        background: isPrimary ? "var(--color-brand)" : "transparent",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-control)",
        color: isPrimary ? "#fff" : "var(--color-text)",
        cursor: "pointer",
        fontWeight: 700,
        padding: "0.7rem 1rem",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
