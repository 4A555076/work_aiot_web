import { useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";
import AppFooter from "./AppFooter";
import ScrollToTopButton from "@/components/common/ScrollToTopButton";

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const scrollContainerRef = useRef(null);

  return (
    <div className="flex h-dvh min-h-dvh overflow-hidden bg-background type-body text-foreground antialiased ">
      <AppSidebar collapsed={collapsed} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <AppHeader
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          setMobileOpen={setMobileOpen}
        />
        <div
          ref={scrollContainerRef}
          className="scrollbar-subtle flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden scroll-smooth"
        >
          <main className="app-page flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8 xl:px-10 2xl:px-12">
            <Outlet />
          </main>
          <AppFooter />
        </div>
        <ScrollToTopButton scrollContainerRef={scrollContainerRef} />
      </div>
    </div>
  );
}
