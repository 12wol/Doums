import { cn } from "@/lib/utils";

export function ColorSwatch({
  hex,
  code,
  size = "md",
  className,
}: {
  hex: string;
  code?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = { sm: "h-6 w-6", md: "h-10 w-10", lg: "h-14 w-14" };
  return (
    <div
      className={cn(
        "shrink-0 rounded-md border border-hairline",
        sizes[size],
        className
      )}
      style={{ backgroundColor: hex }}
      title={code}
    />
  );
}

export function StatCard({
  label,
  value,
  hint,
  block = "lime",
}: {
  label: string;
  value: string | number;
  hint?: string;
  block?: "lime" | "lilac" | "mint" | "cream" | "pink" | "coral";
}) {
  const blocks: Record<string, string> = {
    lime: "bg-block-lime",
    lilac: "bg-block-lilac",
    mint: "bg-block-mint",
    cream: "bg-block-cream",
    pink: "bg-block-pink",
    coral: "bg-block-coral",
  };
  return (
    <div className={cn("color-block", blocks[block])}>
      <p className="eyebrow mb-2 opacity-70">{label}</p>
      <p className="text-3xl font-semibold tracking-tight md:text-4xl">{value}</p>
      {hint && <p className="mt-2 text-sm opacity-70">{hint}</p>}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-base opacity-80">{description}</p>}
      </div>
      {action}
    </div>
  );
}
