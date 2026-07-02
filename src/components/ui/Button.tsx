import type { ReactNode, ButtonHTMLAttributes } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "magenta";

const buttonBase =
  "inline-flex min-h-11 items-center justify-center rounded-pill px-5 py-2.5 text-base font-medium transition-colors";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-on-primary hover:opacity-90",
  secondary: "bg-surface-soft text-ink hover:bg-hairline-soft",
  magenta: "bg-accent-magenta text-on-primary hover:opacity-90",
};

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button className={cn(buttonBase, variants[variant], "disabled:opacity-40", className)} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "secondary",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cn(buttonBase, variants[variant], className)}>
      {children}
    </Link>
  );
}
export function PillLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-pill px-5 py-2.5 text-base font-medium transition-opacity hover:opacity-80",
        className
      )}
    >
      {children}
    </a>
  );
}
