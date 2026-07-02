import { cn } from "@/lib/utils";

export function SeriesFilter({
  series,
  options,
  onChange,
}: {
  series: string;
  options: string[];
  onChange: (s: string) => void;
}) {
  if (options.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      <button
        type="button"
        onClick={() => onChange("")}
        className={cn(
          "rounded-pill px-3 py-1.5 text-sm",
          !series ? "bg-ink text-on-primary" : "bg-surface-soft"
        )}
      >
        全部
      </button>
      {options.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={cn(
            "rounded-pill px-3 py-1.5 text-sm",
            series === s ? "bg-ink text-on-primary" : "bg-surface-soft"
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
