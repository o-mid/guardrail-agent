import Link from "next/link";
import { ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-hover border border-accent focus-visible:shadow-focus disabled:opacity-50 disabled:cursor-not-allowed",
  secondary:
    "bg-surface text-ink border border-line hover:bg-canvas-subtle focus-visible:shadow-focus disabled:opacity-50 disabled:cursor-not-allowed",
  danger:
    "bg-danger text-white border border-danger hover:opacity-90 focus-visible:shadow-focus focus-visible:outline-danger disabled:opacity-50 disabled:cursor-not-allowed",
};

const base =
  "inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-colors";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: Variant;
};

export function ButtonLink({ variant = "primary", className = "", href, children, ...props }: ButtonLinkProps) {
  return (
    <Link href={href} className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </Link>
  );
}
