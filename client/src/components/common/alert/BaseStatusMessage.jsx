import { cn } from "@/lib/utils";

const variantStyles = {
  success: "bg-green-50 border-green-200 text-green-800",
  error: "bg-red-50 border-red-200 text-red-800",
  warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
  info: "bg-blue-50 border-blue-200 text-blue-800",
};

export default function BaseStatusMessage({
  variant = "info",
  icon,
  title,
  description,
  children,
  className,
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-4",
        variantStyles[variant],
        className
      )}
    >
      <div className="flex gap-3">

        {icon && <div className="shrink-0">{icon}</div>}

        <div className="flex-1">
          {title && (
            <h3 className="type-body font-medium ">{title}</h3>
          )}

          {description && (
            <div className="mt-1 type-body opacity-90 ">
              {description}
            </div>
          )}

          {children && <div className="mt-2">{children}</div>}
        </div>
      </div>
    </div>
  );
}
