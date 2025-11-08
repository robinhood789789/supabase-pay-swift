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
    { title: "Providers", url: "/platform/providers", icon: KeyRound },
    { title: "Events", url: "/platform/events", icon: Activity },
    { title: "Webhooks", url: "/platform/webhooks", icon: Webhook },
    { title: "Disputes", url: "/platform/disputes", icon: AlertCircle },
    { title: "Refunds", url: "/platform/refunds", icon: RefreshCw },
    { title: "Settings", url: "/platform/settings", icon: Settings },
    { title: "Security", url: "/platform/security", icon: Shield },
    { title: "Audit", url: "/platform/audit", icon: Activity },
    { title: "Impersonate", url: "/platform/impersonate", icon: UserCheck },
    { title: "Status", url: "/platform/status", icon: Activity },
  ];

  return (
    <Sidebar className="w-64 border-r" collapsible="icon">
      <SidebarContent>
        <div className="p-4 border-b bg-gradient-primary">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shadow-sm">
              <Shield className="w-4 h-4 text-white" />
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-sm text-white">Platform Admin</h2>
                <p className="text-xs text-white/80 font-mono">
                  ID: {publicId || "-"}
                </p>
              </div>
            )}
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Platform Management</SidebarGroupLabel>
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
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto p-4 border-t border-sidebar-border">
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="w-full justify-start"
          >
            <LogOut className="mr-2 h-4 w-4" />
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
