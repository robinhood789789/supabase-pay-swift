import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Wallet, TrendingUp, UserPlus, Settings, LogOut, Copy, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useShareholder } from "@/hooks/useShareholder";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
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
import { AnimatedBackground } from "@/components/ui/animated-background";

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
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const isActive = (path: string) => location.pathname === path;

  const handleCopyId = async () => {
    if (shareholder?.public_id) {
      await navigator.clipboard.writeText(shareholder.public_id);
      setCopied(true);
      toast({
        title: "คัดลอกสำเร็จ!",
        description: `ID: ${shareholder.public_id}`,
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-purple-500/20 bg-gradient-to-b from-slate-900 via-purple-900/20 to-slate-900 backdrop-blur-xl">
      <SidebarHeader className="border-b border-purple-500/30 px-4 py-4 bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-700 relative overflow-hidden shadow-lg before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-1000">
        {open && (
          <div className="flex flex-col gap-3 animate-fade-in relative z-10">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shadow-lg hover:shadow-glow transition-all duration-500 hover:scale-110 hover:rotate-6 cursor-pointer group">
                <Wallet className="h-5 w-5 text-white group-hover:scale-110 transition-transform duration-300" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg text-white transition-all duration-300 hover:scale-105 cursor-default">
                  Shareholder
                </span>
                <span className="text-xs text-white/80">ระบบผู้ถือหุ้น</span>
              </div>
            </div>
            {shareholder?.public_id && (
              <div className="pl-1 space-y-1 animate-fade-in">
                <div className="text-[10px] text-white/70 uppercase tracking-wider font-medium">Shareholder ID</div>
                <button
                  onClick={handleCopyId}
                  className="w-full text-sm font-mono font-bold text-white bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-sm hover:bg-white/20 transition-all duration-300 cursor-pointer shadow-md hover:shadow-glow hover:scale-[1.02] active:scale-95 flex items-center justify-between group"
                >
                  <span>{shareholder.public_id}</span>
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-300 animate-scale-in" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  )}
                </button>
              </div>
            )}
          </div>
        )}
        {!open && (
          <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shadow-lg mx-auto hover:shadow-glow transition-all duration-500 hover:scale-110 hover:rotate-12 cursor-pointer animate-fade-in group relative z-10">
            <Wallet className="h-5 w-5 text-white group-hover:scale-110 transition-transform duration-300" />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2 py-4 bg-gradient-to-b from-transparent via-purple-950/10 to-transparent">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sm font-semibold text-purple-200 uppercase tracking-wider mb-2 px-2">
            เมนูหลัก
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive(item.path)}
                    className="group relative overflow-hidden transition-all duration-500 hover:shadow-lg hover:shadow-primary/20 hover:scale-[1.02] data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary/20 data-[active=true]:to-accent/20 data-[active=true]:border-l-4 data-[active=true]:border-primary data-[active=true]:shadow-glow data-[active=true]:scale-[1.02] before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:translate-x-[-200%] before:transition-transform before:duration-700 hover:before:translate-x-[200%]"
                  >
                    <NavLink to={item.path}>
                      <item.icon className={`h-5 w-5 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 ${isActive(item.path) ? 'text-primary animate-pulse' : 'text-muted-foreground group-hover:text-primary'}`} />
                      <span className={`font-medium transition-all duration-300 group-hover:translate-x-1 ${isActive(item.path) ? 'text-primary font-semibold' : 'group-hover:text-foreground'}`}>
                        {item.label}
                      </span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="my-4 bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-sm font-semibold text-purple-200 uppercase tracking-wider mb-2 px-2">
            จัดการ
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryMenuItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive(item.path)}
                    className="group relative overflow-hidden transition-all duration-500 hover:shadow-lg hover:shadow-accent/20 hover:scale-[1.02] data-[active=true]:bg-gradient-to-r data-[active=true]:from-accent/20 data-[active=true]:to-primary/20 data-[active=true]:border-l-4 data-[active=true]:border-accent data-[active=true]:shadow-glow data-[active=true]:scale-[1.02] before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:translate-x-[-200%] before:transition-transform before:duration-700 hover:before:translate-x-[200%]"
                  >
                    <NavLink to={item.path}>
                      <item.icon className={`h-5 w-5 transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3 ${isActive(item.path) ? 'text-accent animate-pulse' : 'text-muted-foreground group-hover:text-accent'}`} />
                      <span className={`font-medium transition-all duration-300 group-hover:translate-x-1 ${isActive(item.path) ? 'text-accent font-semibold' : 'group-hover:text-foreground'}`}>
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

      <SidebarFooter className="border-t border-red-500/50 p-3 bg-gradient-to-br from-red-900/40 via-red-800/30 to-red-900/40 backdrop-blur-md shadow-inner">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={handleSignOut}
              className="group relative overflow-hidden bg-red-950/30 border border-red-500/40 text-white hover:bg-red-600/90 hover:text-white hover:border-red-400 transition-all duration-500 hover:shadow-xl hover:shadow-red-500/50 hover:scale-[1.03] before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:translate-x-[-200%] before:transition-transform before:duration-700 hover:before:translate-x-[200%]"
            >
              <LogOut className="h-5 w-5 text-red-300 group-hover:text-white group-hover:scale-110 group-hover:rotate-12 transition-all duration-300" />
              <span className="font-semibold group-hover:translate-x-1 transition-transform duration-300">ออกจากระบบ</span>
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
      <div className="flex min-h-screen w-full overflow-x-hidden relative">
        {/* Animated Background */}
        <AnimatedBackground />
        
        <ShareholderSidebar />
        <main className="flex-1 overflow-auto transition-all duration-300 ease-in-out overflow-x-hidden bg-gradient-hero relative z-10">
          <div className="sticky top-0 z-20 flex h-12 sm:h-14 items-center gap-4 border-b border-border/50 bg-card/80 backdrop-blur-sm px-3 sm:px-4 shadow-sm transition-all duration-300">
            <SidebarTrigger className="hover:bg-primary/10 hover:text-primary transition-all duration-300 h-8 w-8 sm:h-10 sm:w-10" />
          </div>
          <div className="p-3 sm:p-4 md:p-6 transition-all duration-300 relative z-10">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
