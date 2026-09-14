import { cn } from "@/lib/utils";
import { Button as ShadcnButton } from "@/components/ui/button";


export default function BaseButton({
  children,
  loading = false,
  disabled,
  permission, 
  className,
  ...props
}) {
  // permission（先預留，之後接 hook）
  if (permission === false) return null;

  return (
    <ShadcnButton
      disabled={disabled || loading}
      className={cn(
        className
      )}
      {...props}
    >
      {loading ? "載入中..." : children}
    </ShadcnButton>
  );
}
