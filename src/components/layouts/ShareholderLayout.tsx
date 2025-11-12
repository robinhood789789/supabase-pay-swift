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
      <SidebarHeader className="border-b border-border px-4 py-4 bg-background">
        {open && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <Wallet className="h-5 w-5 text-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-base text-foreground">
                  Shareholder
                </span>
                <span className="text-xs text-muted-foreground">ระบบผู้ถือหุ้น</span>
              </div>
            </div>
            {shareholder?.public_id && (
              <div className="pl-1 space-y-1">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Shareholder ID</div>
                <button
                  onClick={handleCopyId}
                  className="w-full text-sm font-mono font-semibold text-foreground bg-muted px-3 py-1.5 rounded-lg hover:bg-muted/80 transition-smooth cursor-pointer flex items-center justify-between group"
                >
                  <span>{shareholder.public_id}</span>
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-foreground" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
              </div>
            )}
          </div>
        )}
        {!open && (
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center mx-auto">
            <Wallet className="h-5 w-5 text-foreground" />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2 py-4 bg-background">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2 px-2">
            เมนูหลัก
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive(item.path)}
                    className="group hover:bg-muted/50 data-[active=true]:bg-muted data-[active=true]:border-l-2 data-[active=true]:border-foreground"
                  >
                    <NavLink to={item.path}>
                      <item.icon className={`h-4 w-4 ${isActive(item.path) ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`} />
                      <span className={`font-medium ${isActive(item.path) ? 'text-foreground font-semibold' : 'text-muted-foreground group-hover:text-foreground'}`}>
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
          <SidebarGroupLabel className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2 px-2">
            จัดการ
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryMenuItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive(item.path)}
                    className="group hover:bg-muted/50 data-[active=true]:bg-muted data-[active=true]:border-l-2 data-[active=true]:border-foreground"
                  >
                    <NavLink to={item.path}>
                      <item.icon className={`h-4 w-4 ${isActive(item.path) ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`} />
                      <span className={`font-medium ${isActive(item.path) ? 'text-foreground font-semibold' : 'text-muted-foreground group-hover:text-foreground'}`}>
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

      <SidebarFooter className="border-t border-border p-3 bg-background">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={handleSignOut}
              className="group bg-muted border border-border hover:bg-muted/80 transition-smooth"
            >
              <LogOut className="h-4 w-4" />
              <span className="font-medium">ออกจากระบบ</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      {/* Sign Out Confirmation Dialog */}
      <AlertDialog open={showSignOutDialog} onOpenChange={setShowSignOutDialog}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold text-foreground">ยืนยันการออกจากระบบ</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmSignOut}
            >
              ออกจากระบบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Idle Timeout Warning Dialog */}
      <AlertDialog open={showIdleWarning} onOpenChange={() => {}}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5" />
              แจ้งเตือน: ไม่มีการใช้งาน
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground space-y-2">
              <p>คุณไม่ได้ใช้งานระบบเป็นเวลานาน</p>
              <p className="text-base font-semibold text-foreground">
                ระบบจะออกจากระบบอัตโนมัติใน {remainingTime} นาที
              </p>
              <p className="text-sm">กรุณากดปุ่ม "ฉันยังใช้งานอยู่" เพื่อดำเนินการต่อ</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleIdleLogout}>
              ออกจากระบบเลย
            </AlertDialogAction>
            <AlertDialogAction onClick={handleStayActive}>
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
      <div className="flex min-h-screen w-full overflow-x-hidden">
        <ShareholderSidebar />
        <main className="flex-1 overflow-auto bg-background">
          <div className="sticky top-0 z-20 flex h-12 sm:h-14 items-center gap-4 border-b border-border bg-card px-3 sm:px-4 shadow-soft">
            <SidebarTrigger className="h-8 w-8 sm:h-10 sm:w-10" />
          </div>
          <div className="p-3 sm:p-4 md:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
