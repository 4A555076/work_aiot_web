import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";

import { cn } from "@/lib/utils";

export default function BaseCard({
  title,
  subtitle,
  children,
  className,
  contentClassName,
  headerClassName,
  headerRight,
}) {
  return (
    <Card className={cn("overflow-hidden rounded-2xl border border-border bg-card ring-0 shadow-card", className)}>

      {(title || subtitle || headerRight) && (
        <CardHeader
          className={cn(
            "flex flex-col gap-3 sm:flex-row sm:items-center justify-between border-b border-border px-5 py-4 sm:px-6",
            headerClassName
          )}
        >

          <div className="flex flex-col">
            {title && (
              <CardTitle>
                {title}
              </CardTitle>
            )}

            {subtitle && (
              <p className="mt-1 type-meta text-muted-foreground ">
                {subtitle}
              </p>
            )}
          </div>

          {headerRight && (
            <div className="flex flex-wrap items-center gap-2">
              {headerRight}
            </div>
          )}

        </CardHeader>
      )}

      <CardContent className={cn("p-5 sm:p-6", contentClassName)}>
        {children}
      </CardContent>

    </Card>
  );
}
