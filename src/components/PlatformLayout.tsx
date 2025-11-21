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
    { title: "รายได้ Super Admin", url: "/platform/super-admin-earnings", icon: Wallet },
    { title: "Partner Payouts", url: "/platform/partner-payouts", icon: Wallet },
    { title: "รายงานพาร์ทเนอร์", url: "/platform/partner-reports", icon: BarChart3 },
    { title: "ตั้งค่าพาร์ทเนอร์", url: "/platform/partner-settings", icon: Settings },
    { title: "Tenants", url: "/admin/tenants", icon: Users },
    { title: "จัดการธนาคาร(ลูกค้า)", url: "/admin/customer-bank-accounts", icon: Building2 },
    { title: "รายการเงินเข้า", url: "/admin/incoming-transactions", icon: Wallet },
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
    <Sidebar className="w-64 border-r border-border bg-card" collapsible="icon">
      <SidebarContent>
        <div className="p-4 border-b border-border bg-background">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Shield className="w-5 h-5 text-foreground" />
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-sm text-foreground">Platform Admin</h2>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  ID: {publicId || "-"}
                </p>
              </div>
            )}
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-3">
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
                          ? "bg-primary/10 text-primary font-semibold border-l-4 border-primary text-sm"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground text-sm font-medium transition-smooth"
                      }
                    >
                      <item.icon className={`mr-3 h-4 w-4 ${!isCollapsed ? '' : ''}`} />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto p-4 border-t border-border bg-background">
          <Button
            variant="outline"
            onClick={handleSignOut}
            className="w-full justify-start text-sm font-medium bg-background border border-border text-foreground hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-smooth"
          >
            <LogOut className="mr-3 h-4 w-4" />
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
        <main className="flex-1 overflow-auto bg-background">
          <div className="sticky top-0 z-10 bg-card border-b border-border p-4 shadow-soft">
            <SidebarTrigger />
          </div>
          <div className="p-6">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
