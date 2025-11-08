import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Wallet, TrendingUp, UserPlus, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useShareholder } from "@/hooks/useShareholder";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const mainMenuItems = [
  { icon: LayoutDashboard, label: "แดชบอร์ด", path: "/shareholder/dashboard" },
  { icon: Users, label: "ลูกค้าของฉัน", path: "/shareholder/clients" },
  { icon: TrendingUp, label: "รายได้", path: "/shareholder/earnings" },
  { icon: Wallet, label: "การถอนเงิน", path: "/shareholder/withdrawals" },
];

const secondaryMenuItems = [
  { icon: UserPlus, label: "ทีมงาน", path: "/shareholder/team" },
  { icon: Settings, label: "ตั้งค่า", path: "/shareholder/settings" },
];

function ShareholderSidebar() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { open } = useSidebar();
  const { shareholder } = useShareholder();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarHeader className="border-b border-border/50 px-4 py-4 bg-gradient-to-br from-primary/5 to-accent/5">
        {open && (
          <div className="flex flex-col gap-2 animate-in">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary via-accent to-pink-500 flex items-center justify-center shadow-lg hover:shadow-glow transition-all duration-300 hover:scale-105">
                <span className="text-base font-bold text-white">SH</span>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg bg-gradient-to-r from-primary via-accent to-pink-500 bg-clip-text text-transparent animate-gradient">
                  Shareholder
                </span>
                <span className="text-xs text-muted-foreground">ระบบผู้ถือหุ้น</span>
              </div>
            </div>
            {shareholder?.public_id && (
              <div className="pl-1">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Public ID</div>
                <div className="text-xs font-mono font-semibold text-primary mt-0.5">{shareholder.public_id}</div>
              </div>
            )}
          </div>
        )}
        {!open && (
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary via-accent to-pink-500 flex items-center justify-center shadow-lg mx-auto hover:shadow-glow transition-all duration-300 hover:scale-105">
            <span className="text-base font-bold text-white">SH</span>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            เมนูหลัก
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive(item.path)}
                    className="group relative overflow-hidden transition-all duration-300 hover:shadow-md data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary/10 data-[active=true]:to-accent/10 data-[active=true]:border-l-4 data-[active=true]:border-primary data-[active=true]:shadow-glow"
                  >
                    <NavLink to={item.path}>
                      <item.icon className={`h-5 w-5 transition-all duration-300 ${isActive(item.path) ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`} />
                      <span className={`font-medium transition-all duration-300 ${isActive(item.path) ? 'text-primary' : 'group-hover:text-foreground'}`}>
                        {item.label}
                      </span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="my-4 bg-border/50" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            จัดการ
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryMenuItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive(item.path)}
                    className="group relative overflow-hidden transition-all duration-300 hover:shadow-md data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary/10 data-[active=true]:to-accent/10 data-[active=true]:border-l-4 data-[active=true]:border-primary data-[active=true]:shadow-glow"
                  >
                    <NavLink to={item.path}>
                      <item.icon className={`h-5 w-5 transition-all duration-300 ${isActive(item.path) ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`} />
                      <span className={`font-medium transition-all duration-300 ${isActive(item.path) ? 'text-primary' : 'group-hover:text-foreground'}`}>
                        {item.label}
                      </span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/50 p-3 bg-gradient-to-br from-destructive/5 to-destructive/10">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={handleSignOut}
              className="group hover:bg-destructive/10 hover:text-destructive transition-all duration-300 hover:shadow-md"
            >
              <LogOut className="h-5 w-5 group-hover:scale-110 transition-transform duration-300" />
              <span className="font-medium">ออกจากระบบ</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function ShareholderLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-gradient-to-br from-background via-primary/[0.02] to-accent/[0.02] overflow-x-hidden">
        <ShareholderSidebar />
        <main className="flex-1 overflow-auto transition-all duration-300 ease-in-out overflow-x-hidden">
          <div className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-border/50 bg-background/80 backdrop-blur-sm px-4 shadow-sm transition-all duration-300">
            <SidebarTrigger className="hover:bg-primary/10 hover:text-primary transition-all duration-300" />
          </div>
          <div className="p-6 transition-all duration-300">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
