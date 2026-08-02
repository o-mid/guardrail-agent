type BrandMarkProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-9 w-9 text-xs",
  lg: "h-11 w-11 text-sm",
};

export function BrandMark({ size = "md", className = "" }: BrandMarkProps) {
  return (
    <span
      aria-hidden
      className={`inline-flex items-center justify-center border-2 border-accent bg-surface font-display font-bold text-accent ${sizes[size]} ${className}`}
    >
      G
    </span>
  );
}
