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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { Clock } from "lucide-react";

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
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  
  // Idle timeout with 30 minutes total, 2 minutes warning
  const { 
    showWarning: showIdleWarning, 
    remainingTime, 
    handleStayActive, 
    handleLogout: handleIdleLogout 
  } = useIdleTimeout({
    timeoutMinutes: 30,
    warningMinutes: 2,
    enabled: true,
  });

  const handleSignOut = () => {
    setShowSignOutDialog(true);
  };

  const confirmSignOut = async () => {
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
    <Sidebar collapsible="icon" className="border-r border-border bg-background">
      <SidebarHeader className="border-b border-border px-4 py-4 bg-card">
        {open && (
          <div className="flex flex-col gap-3 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg text-foreground">
                  Shareholder
                </span>
                <span className="text-xs text-muted-foreground">ระบบผู้ถือหุ้น</span>
              </div>
            </div>
            {shareholder?.public_id && (
              <div className="pl-1 space-y-1 animate-fade-in">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Shareholder ID</div>
                <button
                  onClick={handleCopyId}
                  className="w-full text-sm font-mono font-bold text-foreground bg-muted/50 px-3 py-1.5 rounded-lg hover:bg-muted transition-all duration-300 cursor-pointer flex items-center justify-between group"
                >
                  <span>{shareholder.public_id}</span>
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-500 animate-scale-in" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  )}
                </button>
              </div>
            )}
          </div>
        )}
        {!open && (
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto animate-fade-in">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2 py-4 bg-background">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sm font-semibold text-foreground uppercase tracking-wider mb-2 px-2">
            เมนูหลัก
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive(item.path)}
                    className="group transition-all duration-300 hover:bg-primary/10 data-[active=true]:bg-primary/15 data-[active=true]:border-l-4 data-[active=true]:border-primary"
                  >
                    <NavLink to={item.path}>
                      <item.icon className={`h-5 w-5 transition-all duration-300 ${isActive(item.path) ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`} />
                      <span className={`font-medium transition-all duration-300 ${isActive(item.path) ? 'text-primary font-semibold' : 'text-foreground group-hover:text-primary'}`}>
                        {item.label}
                      </span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="my-4 bg-border" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-sm font-semibold text-foreground uppercase tracking-wider mb-2 px-2">
            จัดการ
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryMenuItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive(item.path)}
                    className="group transition-all duration-300 hover:bg-accent/10 data-[active=true]:bg-accent/15 data-[active=true]:border-l-4 data-[active=true]:border-accent"
                  >
                    <NavLink to={item.path}>
                      <item.icon className={`h-5 w-5 transition-all duration-300 ${isActive(item.path) ? 'text-accent' : 'text-muted-foreground group-hover:text-accent'}`} />
                      <span className={`font-medium transition-all duration-300 ${isActive(item.path) ? 'text-accent font-semibold' : 'text-foreground group-hover:text-accent'}`}>
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

      <SidebarFooter className="border-t border-border p-3 bg-card">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={handleSignOut}
              className="group bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive hover:text-white transition-all duration-300"
            >
              <LogOut className="h-5 w-5 transition-all duration-300" />
              <span className="font-semibold">ออกจากระบบ</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      {/* Sign Out Confirmation Dialog */}
      <AlertDialog open={showSignOutDialog} onOpenChange={setShowSignOutDialog}>
        <AlertDialogContent className="bg-card/95 backdrop-blur-xl border-red-500/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-foreground">ยืนยันการออกจากระบบ</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="hover:bg-muted/80">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmSignOut}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              ออกจากระบบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Idle Timeout Warning Dialog */}
      <AlertDialog open={showIdleWarning} onOpenChange={() => {}}>
        <AlertDialogContent className="bg-card/95 backdrop-blur-xl border-yellow-500/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
              <Clock className="w-6 h-6 text-yellow-500 animate-pulse" />
              แจ้งเตือน: ไม่มีการใช้งาน
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground space-y-2">
              <p>คุณไม่ได้ใช้งานระบบเป็นเวลานาน</p>
              <p className="text-lg font-semibold text-yellow-500">
                ระบบจะออกจากระบบอัตโนมัติใน {remainingTime} นาที
              </p>
              <p className="text-sm">กรุณากดปุ่ม "ฉันยังใช้งานอยู่" เพื่อดำเนินการต่อ</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction 
              onClick={handleIdleLogout}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              ออกจากระบบเลย
            </AlertDialogAction>
            <AlertDialogAction 
              onClick={handleStayActive}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              ฉันยังใช้งานอยู่
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
