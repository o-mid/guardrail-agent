"use client";

import Link from "next/link";
import { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import { Button as UiButton, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger";

const mapped = {
  primary: "default",
  secondary: "secondary",
  danger: "destructive",
} as const;

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
    <UiButton type={type} variant={mapped[variant]} className={className} {...props}>
      {children}
    </UiButton>
  );
}

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: Variant;
};

export function ButtonLink({
  variant = "primary",
  className = "",
  href,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant: mapped[variant] }), className)}
      {...props}
    >
      {children}
    </Link>
  );
}
