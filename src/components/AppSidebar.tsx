import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, GitCompareArrows, Lightbulb, Settings } from "lucide-react";
import ydataLogo from "@/assets/ydata-logo-white.png";
import { APP_SHORT_NAME, APP_ENDORSEMENT, KPMG_MARK_SRC } from "@/lib/branding";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Use cases", url: "/use-cases", icon: Lightbulb },
  { title: "Compare", url: "/compare", icon: GitCompareArrows },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [markFailed, setMarkFailed] = useState(false);
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border/60 px-4 py-4">
        <div className="flex items-center gap-2.5">
          <img
            src={ydataLogo}
            alt="YData logo"
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 object-contain"
          />

          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-bold text-sidebar-foreground">
                {APP_SHORT_NAME}
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="whitespace-nowrap text-[9px] uppercase tracking-wider text-sidebar-foreground/70">
                  {APP_ENDORSEMENT}
                </span>
                {/* Fix 1.2 — never render a mark we cannot guarantee resolves. */}
                {KPMG_MARK_SRC && !markFailed ? (
                  <img
                    src={KPMG_MARK_SRC}
                    alt="KPMG"
                    className="h-2.5 w-auto shrink-0 object-contain"
                    onError={() => setMarkFailed(true)}
                  />
                ) : (
                  <span className="text-[10px] font-bold tracking-tight text-sidebar-foreground">
                    KPMG
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active =
                  item.url === "/" ? pathname === "/" : pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className={cn(
                          "transition-colors",
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "hover:bg-sidebar-accent/50",
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60 p-3">
        {!collapsed && (
          <p className="text-[10px] leading-relaxed text-sidebar-foreground/50">
            Internal business case tool. Figures are illustrative estimates.
          </p>

        )}
      </SidebarFooter>
    </Sidebar>
  );
}
