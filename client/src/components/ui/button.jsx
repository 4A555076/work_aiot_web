import { cva } from "class-variance-authority"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"


const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center border border-transparent bg-clip-padding type-body font-semibold whitespace-nowrap outline-none select-none transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-150 ease-out focus-visible:ring-3 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/25 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:border-primary-hover hover:bg-primary-hover hover:shadow-md hover:shadow-primary/20 active:border-primary-hover active:bg-primary-hover active:shadow-inner focus-visible:ring-primary/35 aria-expanded:border-primary-hover aria-expanded:bg-primary-hover",

        secondary:
          "border-info/30 bg-info/10 text-info shadow-sm shadow-info/10 hover:border-info/45 hover:bg-info/15 active:border-info/55 active:bg-info/20 active:shadow-inner focus-visible:ring-info/30 aria-expanded:border-info/45 aria-expanded:bg-info/15",

        outline:
          "border-border bg-background text-foreground shadow-sm shadow-black/5 hover:border-primary/45 hover:bg-primary/8 hover:text-primary active:border-primary/60 active:bg-primary/12 active:shadow-inner focus-visible:ring-primary/30 aria-expanded:border-primary/45 aria-expanded:bg-primary/8 aria-expanded:text-primary",

        ghost:
          "border-transparent bg-transparent text-muted-foreground shadow-none hover:bg-muted hover:text-foreground active:bg-primary/10 active:text-primary focus-visible:ring-primary/30 aria-expanded:bg-muted aria-expanded:text-foreground",

        destructive:
          "border-destructive bg-destructive text-white shadow-sm shadow-destructive/20 hover:bg-destructive/90 hover:shadow-md hover:shadow-destructive/20 active:bg-destructive/80 active:shadow-inner focus-visible:ring-destructive/35 aria-expanded:bg-destructive/90",

        "destructive-ghost":
          "border-transparent bg-transparent text-destructive shadow-none hover:border-destructive/20 hover:bg-destructive/10 active:border-destructive/30 active:bg-destructive/15 focus-visible:ring-destructive/30 aria-expanded:bg-destructive/10",

        "table-action":
          "border-info/25 bg-info/8 text-info shadow-none hover:border-info/40 hover:bg-info/12 active:border-info/50 active:bg-info/18 focus-visible:ring-info/30 aria-expanded:bg-info/12",

        "table-action-destructive":
          "border-transparent bg-transparent text-muted-foreground shadow-none hover:border-destructive/20 hover:bg-destructive/10 hover:text-destructive active:border-destructive/30 active:bg-destructive/15 active:text-destructive focus-visible:ring-destructive/30 aria-expanded:bg-destructive/10 aria-expanded:text-destructive",

        link:
          "border-transparent bg-transparent text-primary shadow-none underline-offset-4 hover:text-primary-hover hover:underline active:text-primary-hover focus-visible:ring-primary/30",

        export:
          "border-success/30 bg-success/10 text-success shadow-sm shadow-success/10 hover:border-success/45 hover:bg-success/15 active:border-success/55 active:bg-success/20 active:shadow-inner focus-visible:ring-success/30 aria-expanded:border-success/45 aria-expanded:bg-success/15",

        warm:
          "border-warning/30 bg-warning/10 text-warning shadow-sm shadow-warning/10 hover:border-warning/45 hover:bg-warning/15 active:border-warning/55 active:bg-warning/20 active:shadow-inner focus-visible:ring-warning/30 aria-expanded:border-warning/45 aria-expanded:bg-warning/15",
      },
      size: {
        default:
          "h-11 gap-2 rounded-xl px-4 type-body xl:h-12 2xl:h-13 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 [&_svg:not([class*='size-'])]:size-4",
        xs:
          "h-9 gap-1.5 rounded-md px-2.5 text-sm xl:h-10 xl:text-base 2xl:h-11 2xl:text-lg in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        sm:
          "h-9 gap-1.5 rounded-lg px-3 text-sm xl:h-10 xl:text-base 2xl:h-11 2xl:text-lg in-data-[slot=button-group]:rounded-xl has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-4",
        table:
          "h-9 gap-1.5 rounded-lg px-3 text-sm xl:h-10 xl:text-base 2xl:h-11 2xl:text-lg has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg:
          "h-13 gap-2 rounded-2xl px-5 type-body has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4 [&_svg:not([class*='size-'])]:size-5",
        xl:
          "h-15 gap-2.5 rounded-2xl px-6 type-body font-medium has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5 [&_svg:not([class*='size-'])]:size-5",
        "icon-xs":
          "size-7 rounded-lg p-0 [&_svg:not([class*='size-'])]:size-3.5",
        "table-icon":
          "size-8 rounded-lg p-0 [&_svg:not([class*='size-'])]:size-4",
        "icon-sm":
          "size-9 rounded-xl p-0 [&_svg:not([class*='size-'])]:size-4",
        icon:
          "size-11 rounded-xl p-0 [&_svg:not([class*='size-'])]:size-[18px]",
        "icon-lg":
          "size-13 rounded-2xl p-0 [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props} />
  );
}

export { Button, buttonVariants }
