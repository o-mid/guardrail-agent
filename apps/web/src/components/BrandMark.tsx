import { cn } from "@/lib/utils";

type BrandMarkProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
};

export function BrandMark({ size = "md", className = "" }: BrandMarkProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex items-center justify-center rounded-md border border-primary/40 bg-card font-mono font-semibold text-primary",
        "[box-shadow:var(--shadow-xs)]",
        sizes[size],
        className,
      )}
    >
      G
    </span>
  );
}
