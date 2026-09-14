import { Link, NavLink } from "react-router-dom";
import { House, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMenuData } from "@/hook/useMenuData";
import Logo from "@/assets/Logo.png";
import { Button } from "@/components/ui/button";

export default function AppSidebar({ collapsed, mobileOpen, setMobileOpen }) {
  const { data: menuData = [], loading, error } = useMenuData();

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px] md:hidden"
          aria-label="關閉導覽選單"
        />
      )}
      <aside
        className={cn(
          "fixed z-50 flex h-full w-[min(18rem,88vw)] flex-col overflow-hidden border-r border-sidebar-border bg-sidebar shadow-2xl transition-[width,transform] duration-300 ease-out sm:w-72 md:static md:shadow-none",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          collapsed ? "md:w-18 lg:w-20 2xl:w-22" : "md:w-60 lg:w-64 xl:w-68 2xl:w-72",
        )}
      >
        <Link to="/" onClick={() => setMobileOpen(false)} className="shrink-0">
          <div className={cn("flex h-16 items-center px-4 sm:h-17 sm:px-5 2xl:h-18 2xl:px-5", collapsed && "md:justify-center md:px-2")}>
            <div className="flex min-w-0 items-center gap-2.5 2xl:gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-light ring-1 ring-primary/10 2xl:size-11">
                <img src={Logo} alt="AIoTWEB" className="max-h-5 max-w-7 object-contain" />
              </div>
              <div className={cn("min-w-0", collapsed && "md:hidden")}>
                <p className="truncate type-section-title font-bold tracking-tight text-foreground ">AIoTWEB</p>
                <p className="mt-0.5 text-sm 2xl:text-base font-medium text-muted-foreground">資訊整合平台</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={(event) => { event.preventDefault(); setMobileOpen(false); }}
              className="ml-auto md:hidden"
              aria-label="關閉導覽選單"
            >
              <X size={19} />
            </Button>
          </div>
        </Link>

        <nav className={cn("scrollbar-subtle min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 text-sm sm:py-4 lg:space-y-4 xl:text-base 2xl:space-y-5 2xl:px-4 2xl:py-4 2xl:text-lg", collapsed && "md:space-y-2 md:px-2")} aria-label="主要導覽">
          <div className="space-y-1">
            <h3 className={cn("px-3 text-sm 2xl:text-base uppercase text-muted-foreground/85", collapsed && "md:hidden")}>總覽</h3>
            <NavLink
              to="/"
              end
              onClick={() => setMobileOpen(false)}
              title={collapsed ? "首頁" : undefined}
              className={({ isActive }) => cn(
                "group mt-1.5 flex min-h-11 items-center rounded-xl px-3 py-2.5 font-medium transition-[color,background-color,box-shadow,transform] 2xl:min-h-12 2xl:px-3.5 2xl:py-3",
                collapsed && "md:justify-center",
                isActive
                  ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground shadow-[0_8px_18px_rgba(14,165,233,0.2)]"
                  : "text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <span className={cn("mr-2.5 grid size-7 shrink-0 place-items-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground transition-colors group-aria-[current=page]:bg-white/20 group-aria-[current=page]:text-white", collapsed && "md:mr-0")}>
                <House size={17} className="2xl:size-5" />
              </span>
              <span className={cn("truncate", collapsed && "md:hidden")}>首頁</span>
            </NavLink>
          </div>

          {loading && <div className="space-y-2 px-2">{[1, 2, 3].map((item) => <div key={item} className="h-11 animate-pulse rounded-xl bg-muted/80 2xl:h-12" />)}</div>}
          {error && <p className={cn("rounded-xl bg-destructive/10 p-3 type-body text-destructive ", collapsed && "md:hidden")}>導覽選單載入失敗</p>}
          {menuData.map((group) => (
            <div key={group.category} className="space-y-1 border-t border-sidebar-border/60 pt-3 lg:pt-4 2xl:pt-4">
              <h3 className={cn("px-3 text-sm 2xl:text-base uppercase text-muted-foreground/85", collapsed && "md:hidden")}>{group.category}</h3>
              <div className="mt-1.5 space-y-1 2xl:space-y-1.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? item.name : undefined}
                    className={({ isActive }) => cn(
                      "group flex min-h-11 items-center rounded-xl px-3 py-2.5 font-medium transition-[color,background-color,box-shadow,transform] 2xl:min-h-12 2xl:px-3.5 2xl:py-3",
                      collapsed && "md:justify-center",
                      isActive
                        ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground shadow-[0_8px_18px_rgba(14,165,233,0.2)]"
                        : "text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <span className={cn("mr-2.5 grid size-7 shrink-0 place-items-center rounded-lg bg-sidebar-accent text-sm 2xl:text-base font-bold text-sidebar-accent-foreground transition-colors group-aria-[current=page]:bg-white/20 group-aria-[current=page]:text-white 2xl:size-8 ", collapsed && "md:mr-0")}>{item.serial}</span>
                    <span className={cn("truncate type-body tracking-wide", collapsed && "md:hidden")}>{item.name}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
