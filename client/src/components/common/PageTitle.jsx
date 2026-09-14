import { ChevronRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useMenuData } from "@/hook/useMenuData";

export default function PageTitle({ title, description, actions, status }) {
  const location = useLocation();
  const { data: menuData = [], loading: loadingMenu, error: errorMenu } = useMenuData();
  const currentGroup = menuData.find((group) => group?.items?.some((item) => item?.path === location.pathname));
  const currentPage = currentGroup?.items?.find((item) => item?.path === location.pathname);
  const pageTitle = title || currentPage?.name;

  if (loadingMenu && !title) {
    return (
      <div className="mb-6 animate-pulse space-y-3 border-b border-border pb-5 sm:mb-8 sm:pb-6">
        <div className="h-3 w-40 rounded bg-muted" />
        <div className="h-8 w-56 rounded-lg bg-muted" />
        {description && <div className="h-4 w-72 max-w-full rounded bg-muted/70" />}
      </div>
    );
  }

  if (errorMenu) console.error("PageTitle 載入選單失敗:", errorMenu);
  if (!pageTitle && !description) return null;

  return (
    <header className="mb-6 border-b border-border pb-5 sm:mb-8 sm:pb-6">
      <div className="mb-3 flex flex-wrap items-center gap-1.5 type-meta text-muted-foreground " aria-label="麵包屑">
        <Link to="/" className="hover:underline"><span>首頁</span></Link>
        {currentGroup?.category && <><ChevronRight size={12} /><span>{currentGroup.category}</span></>}
        {pageTitle && <><ChevronRight size={12} /><span className="font-medium text-foreground">{pageTitle}</span></>}
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="flex items-baseline gap-2 type-page-title font-bold tracking-tight text-foreground ">
              {currentPage?.serial && <span className="font-semibold text-primary tabular-nums">{currentPage.serial}.</span>}
              <span>{pageTitle}</span>
            </h1>
            {status}
          </div>
          {description && <p className="mt-2 max-w-3xl type-body leading-relaxed text-muted-foreground ">{description}</p>}
        </div>
        {actions && <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">{actions}</div>}
      </div>
    </header>
  );
}
