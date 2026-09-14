import { cn } from "@/lib/utils";

export default function BaseList({
  items = [],
  className = "",
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border divide-y divide-border bg-card", className)}>
      {items.map((item, index) => (
        <div
          key={index}
          className="flex items-start gap-3 p-4 transition-colors hover:bg-muted/50"
        >
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-info text-sm xl:size-7 2xl:size-8 xl:text-base 2xl:text-lg font-semibold tabular-nums text-white">
            {index + 1}
          </span>
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-4">
            <div className="text-muted-foreground">{item.label}</div>
            <div className="break-all">{item.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
