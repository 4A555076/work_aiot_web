import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils";


export default function BaseInput({
  label,
  error,
  className,
  disabled,
  id,
  name,
  endAdornment,
  ...props
}) {
  const inputId = id || name;

  return (
    <div className="flex w-full flex-col gap-2">
      
      {label && (
        <Label htmlFor={inputId} className="type-meta font-semibold text-foreground ">{label}</Label>
      )}

      <div className="relative">
        <Input
          disabled={disabled}
          id={inputId}
          name={name}
          className={cn(
            error && "border-destructive focus-visible:ring-destructive/5",
            disabled && "opacity-50 cursor-not-allowed",
            endAdornment && "pr-11",
            "h-11 rounded-xl border bg-card px-3 shadow-none transition-colors hover:border-muted-foreground/50 focus-visible:border-primary text-base xl:h-12 2xl:h-13",
            className
          )}
          {...props}
        />
        {endAdornment && (
          <div className="absolute inset-y-0 right-1 flex items-center">
            {endAdornment}
          </div>
        )}
      </div>

      {error && (
        <span className="type-meta text-destructive ">
          {error}
        </span>
      )}
    </div>
  );
}
