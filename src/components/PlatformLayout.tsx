import { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
 } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  Shield,
  Activity,
  Settings,
  LogOut,
  KeyRound,
  Webhook,
  AlertCircle,
  RefreshCw,
  UserCheck,
  BarChart3,
  Wallet,
  AlertTriangle,
  Building2,
} from "lucide-react";

interface PlatformLayoutProps {
  children: ReactNode;
}

const PlatformSidebar = () => {
  const { state } = useSidebar();
  const { signOut, user, publicId } = useAuth();
  const navigate = useNavigate();
  const isCollapsed = state === "collapsed";

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth/sign-in");
  };

  const menuItems = [
    { title: "Overview", url: "/admin", icon: LayoutDashboard },
    { title: "จัดการพาร์ทเนอร์", url: "/platform/partners", icon: Users },
    { title: "รายได้ Shareholder", url: "/platform/shareholder-earnings", icon: Wallet },
    { title: "Partner Payouts", url: "/platform/partner-payouts", icon: Wallet },
    { title: "รายงานพาร์ทเนอร์", url: "/platform/partner-reports", icon: BarChart3 },
    { title: "ตั้งค่าพาร์ทเนอร์", url: "/platform/partner-settings", icon: Settings },
    { title: "Tenants", url: "/admin/tenants", icon: Users },
    { title: "จัดการธนาคาร(ลูกค้า)", url: "/admin/customer-bank-accounts", icon: Building2 },
    { title: "Providers", url: "/platform/providers", icon: KeyRound },
    { title: "Events", url: "/platform/events", icon: Activity },
    { title: "Webhooks", url: "/platform/webhooks", icon: Webhook },
    { title: "Disputes", url: "/platform/disputes", icon: AlertCircle },
    { title: "Refunds", url: "/platform/refunds", icon: RefreshCw },
    { title: "Settings", url: "/platform/settings", icon: Settings },
    { title: "Security", url: "/platform/security", icon: Shield },
    { title: "Security Alerts", url: "/security-alerts", icon: AlertTriangle },
    { title: "Audit", url: "/platform/audit", icon: Activity },
    { title: "Impersonate", url: "/platform/impersonate", icon: UserCheck },
    { title: "Status", url: "/platform/status", icon: Activity },
  ];

  return (
    <Sidebar className="w-64 border-r bg-background" collapsible="icon">
      <SidebarContent>
        <div className="p-5 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-base text-foreground tracking-wide">Platform Admin</h2>
                <p className="text-sm text-primary font-mono font-semibold mt-0.5">
                  ID: {publicId || "-"}
                </p>
              </div>
            )}
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 px-3">
            Platform Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/admin"}
                      className={({ isActive }) =>
                        isActive
                          ? "bg-primary/15 text-primary font-semibold border-l-2 border-primary text-sm"
                          : "text-foreground hover:bg-primary/10 hover:text-primary hover:border-l-2 hover:border-primary/50 text-sm font-medium transition-all duration-300"
                      }
                    >
                      <item.icon className="mr-3 h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto p-4 border-t border-border bg-card/50">
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="w-full justify-start hover:bg-destructive/10 hover:text-destructive text-sm font-medium transition-all duration-200"
          >
            <LogOut className="mr-3 h-5 w-5" />
            {!isCollapsed && <span>Sign Out</span>}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
};

export function PlatformLayout({ children }: PlatformLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full overflow-x-hidden">
        <PlatformSidebar />
        <main className="flex-1 overflow-auto transition-all duration-300 ease-in-out overflow-x-hidden bg-gradient-hero">
          <div className="sticky top-0 z-10 bg-card/80 backdrop-blur-sm border-b border-border/50 p-4 transition-all duration-300 shadow-sm">
            <SidebarTrigger className="ml-2" />
          </div>
          <div className="p-6 transition-all duration-300">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
