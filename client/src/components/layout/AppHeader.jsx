import { LogOut, Menu, User } from "lucide-react";
import Cookies from "js-cookie";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function AppHeader({ collapsed, setCollapsed, setMobileOpen }) {
  const name = Cookies.get("name") || "管理者";
  const navigate = useNavigate();

  const handleLogout = () => {
    Cookies.remove("token");
    Cookies.remove("ID");
    Cookies.remove("name");
    navigate("/login", { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 flex h-18 shrink-0 items-center justify-between border-b border-border bg-card/90 px-4 backdrop-blur-xl sm:px-6">

      <div className="flex items-center gap-3">

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(true)} 
          className="md:hidden"
          aria-label="開啟導覽選單"
        >
          <Menu size={18}/>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)} 
          className="hidden md:inline-flex"
          aria-label={collapsed ? "展開側邊欄" : "收合側邊欄"}
        >
          <Menu size={18}/>
        </Button>

      </div>

      <div className="flex items-center gap-2 sm:gap-3">

        {/* <button 
          type="button" 
          className="grid size-10 place-items-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-primary-light hover:text-primary" 
          aria-label="通知"
        >
          <Bell size={17}/>
        </button> */}

        <div className="flex items-center gap-2.5 rounded-xl border border-border bg-secondary/80 py-1.5 pl-1.5 pr-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <User size={15} strokeWidth={2.5}/>
          </div>
          <span className="type-body font-semibold text-foreground ">{name}</span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout} 
          aria-label="登出" 
          title="登出"
        >
          <LogOut size={15}/>
          <span className="hidden lg:inline">登出</span>
        </Button>
      
      </div>
      
    </header>
  );
}
