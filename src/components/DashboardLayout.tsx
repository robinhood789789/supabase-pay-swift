import { ReactNode } from "react";
import * as React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { TenantSwitcher } from "@/components/TenantSwitcher";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { useI18n } from "@/lib/i18n";
import { useShareholder } from "@/hooks/useShareholder";

import { usePermissions } from "@/hooks/usePermissions";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";
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
import { Badge } from "@/components/ui/badge";
import { PermissionGate } from "@/components/PermissionGate";
import {
  LayoutDashboard,
  Settings,
  Users,
  LogOut,
  Shield,
  CreditCard,
  Link2,
  BarChart3,
  Book,
  Rocket,
  RefreshCw,
  UserCircle,
  Webhook,
  DollarSign,
  PieChart,
  ArrowDownToLine,
  ArrowUpFromLine,
  
  Receipt,
  KeyRound,
  Activity,
  Package,
  FileCheck,
  AlertCircle,
  UserCheck,
  Wallet,
} from "lucide-react";
import { AnimatedBackground } from "@/components/ui/animated-background";
import { ColorHarmonySelector } from "@/components/ui/color-harmony-selector";

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardSidebar = () => {
  const { state } = useSidebar();
  const { signOut, isSuperAdmin, user, publicId } = useAuth();
  const { t } = useI18n();
  const isCollapsed = state === "collapsed";
  const { hasPermission } = usePermissions();
  const { activeTenant } = useTenantSwitcher();
  const { isShareholder } = useShareholder();

  const isOwner = activeTenant?.roles?.name === 'owner';

  // Overview section - available to all users
  const userMenuItems = [
    { title: t('dashboard.title'), url: "/dashboard", icon: LayoutDashboard, permission: null }, // Always visible
    { title: t('dashboard.reports'), url: "/reports", icon: BarChart3, permission: "reports.view" },
  ].filter(item => !item.permission || hasPermission(item.permission) || isOwner);

  // Transaction menu items - filtered by actual permissions
  const allTransactionItems = [
    { title: "Transaction Dashboard", url: "/transactions-dashboard", icon: PieChart, permission: null }, // Available to all
    { title: t('dashboard.deposit'), url: "/deposit-list", icon: ArrowDownToLine, permission: "deposits.view" },
    { title: t('dashboard.withdrawal'), url: "/withdrawal-list", icon: ArrowUpFromLine, permission: "withdrawals.view" },
    { 
      title: t('dashboard.payments'), 
      url: "/payments", 
      icon: CreditCard, 
      permission: "payments.view",
      roleAccess: ['owner', 'manager'] // Only Owner and Manager can access
    },
    { 
      title: "Payment Links", 
      url: "/links", 
      icon: Link2, 
      permission: "payments.view",
      roleAccess: ['owner', 'manager', 'finance'] // H-1: เพิ่ม Payment Links ใน sidebar
    },
    { 
      title: "Webhooks", 
      url: "/webhook-events", 
      icon: Webhook, 
      permission: "webhooks.view",
      roleAccess: ['owner', 'developer', 'manager', 'finance'] // Technical and financial roles
    },
  ];
  
  // Filter transaction items based on actual permissions
  const transactionMenuItems = allTransactionItems.filter(item => {
    // Check if item has specific role access requirements
    if ((item as any).roleAccess) {
      const userRole = activeTenant?.roles?.name;
      return (item as any).roleAccess.includes(userRole);
    }
    // Otherwise use permission-based access
    return !item.permission || hasPermission(item.permission) || isOwner;
  });

  // System Deposit button - show for owner only
  const showSystemDeposit = isOwner && !isSuperAdmin;

  // Owner menu items (tenant-level management)
  const ownerMenuItems = isOwner ? [
    { title: t('dashboard.staffMembers'), url: "/admin/users", icon: Users },
    { title: t('dashboard.approvals'), url: "/approvals", icon: Shield },
    { title: t('dashboard.activityHistory'), url: "/activity-history", icon: Activity },
  ] : [];

  // Management menu items - filtered by permissions
  const allManagementItems = [
    { title: "Workbench", url: "/workbench", icon: Activity, ownerOnly: true }, // Owner only
    { title: "Products", url: "/products", icon: Package, permission: "products.view" },
    { title: "Payment Methods", url: "/payment-methods", icon: CreditCard, permission: "payment_methods.manage" },
    { title: "Reconciliation", url: "/reconciliation", icon: FileCheck, ownerOnly: true }, // Owner only - sensitive financial data
    { title: "Disputes", url: "/disputes", icon: AlertCircle, permission: "disputes.view" },
    { title: "KYC Verification", url: "/kyc-verification", icon: UserCheck, ownerOnly: true }, // Owner only - sensitive compliance data
    { title: t('dashboard.mdr'), url: "/mdr", icon: Receipt, ownerOnly: true }, // Owner only
    { title: t('customers.title'), url: "/customers", icon: UserCircle, permission: "customers.view" },
    { title: t('settlements.title'), url: "/settlements", icon: DollarSign, ownerOnly: true }, // Owner only - sensitive financial data
    // H-2: ลบ Webhooks ซ้ำจาก Management (อยู่ใน Transaction แล้ว)
  ];
  
  // Filter management items based on actual permissions
  const managementMenuItems = allManagementItems.filter((item: any) =>
    (item.ownerOnly ? isOwner : (!item.permission || hasPermission(item.permission) || isOwner))
  );

  // Developers menu items - H-3: แยก API Keys/Webhooks/Docs
  const developersMenuItems = [
    { title: 'API Keys', url: "/settings?tab=api-keys", icon: KeyRound, permission: "api_keys.view" },
    { title: 'Webhooks (Outbound)', url: "/settings?tab=webhooks", icon: Webhook, permission: "webhooks.manage" },
    { title: 'API Docs', url: "/docs", icon: Book, ownerOnly: true },
  ].filter((item: any) =>
    (item.ownerOnly ? isOwner : (!item.permission || hasPermission(item.permission) || isOwner))
  );

  // Settings menu items - filtered by permissions
  const allSettingsItems = [
    { title: t('dashboard.settings'), url: "/settings", icon: Settings }, // Available to all authenticated users
    { title: 'คู่มือการทดสอบ', url: "/testing-guide", icon: FileCheck, ownerOnly: true },
  ];
  
  const settingsMenuItems = allSettingsItems.filter((item: any) =>
    (item.ownerOnly ? isOwner : true) // Settings visible to all, testing guide for owner only
  );

  // Go-Live for owners
  const goLiveItems = isOwner ? [
    { title: 'Go Live', url: "/go-live", icon: Rocket },
    { title: 'Controls Test', url: "/go-live/controls", icon: Shield },
    { title: 'Gap Report', url: "/reports/gap", icon: FileCheck, ownerOnly: true },
    { title: 'Pyramid Model', url: "/pyramid-authority", icon: Shield, ownerOnly: true },
    { title: 'Alerts', url: "/alerts", icon: AlertCircle },
  ] : [];

  const superAdminMenuItems = [
    { title: "Overview", url: "/admin", icon: LayoutDashboard },
    { title: "จัดการพาร์ทเนอร์", url: "/platform/partners", icon: Users },
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

  // Shareholder menu items
  const shareholderMenuItems = [
    { title: "Dashboard", url: "/shareholder/dashboard", icon: LayoutDashboard },
    { title: "My Clients", url: "/shareholder/clients", icon: Users },
    { title: "Earnings", url: "/shareholder/earnings", icon: DollarSign },
    { title: "Withdrawals", url: "/shareholder/withdrawals", icon: Wallet },
  ];

  // Debug menu - always available
  const debugMenuItems = [
    { title: "🔍 Auth Status Test", url: "/auth-status", icon: Activity },
  ];

  return (
    <Sidebar className="w-64 border-r-2 border-primary/20 backdrop-blur-3xl bg-card/98 shadow-elegant" collapsible="icon">
      <SidebarContent>
        <div className="p-4 border-b-2 border-primary/10 backdrop-blur-3xl bg-background/90">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
              <Shield className="w-4 h-4 text-primary-foreground drop-shadow-lg" />
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-sm text-foreground glass-text">SaaS Platform</h2>
                <p className="text-xs text-muted-foreground font-mono glass-text">
                  ID: {publicId || "-"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Main Menu - Hidden for Super Admin and Shareholder */}
        {!isSuperAdmin && !isShareholder && userMenuItems.length > 0 && (
          <SidebarGroup className="border-l-[6px] border-primary/40 bg-primary/8 pl-3 py-2 rounded-r-lg shadow-glow-cosmic">
            <SidebarGroupLabel className="text-primary font-bold glass-text uppercase tracking-wider text-xs">{t('dashboard.overview')}</SidebarGroupLabel>
            <SidebarGroupContent>
                <SidebarMenu>
                {userMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
                        className={({ isActive }) =>
                          isActive
                            ? "bg-primary/20 text-primary font-bold border-l-2 border-primary shadow-glow-info glass-text"
                            : "text-foreground/90 hover:bg-primary/10 hover:text-primary hover:border-l-2 hover:border-primary/50 transition-all duration-300 glass-text"
                        }
                      >
                        <item.icon className="mr-2 h-4 w-4 transition-transform duration-300 group-hover:scale-110 drop-shadow-md" />
                        {!isCollapsed && <span className="glass-text">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Transaction Menu - Hidden for Super Admin and Shareholder */}
        {!isSuperAdmin && !isShareholder && (transactionMenuItems.length > 0 || showSystemDeposit) && (
          <SidebarGroup className="border-l-[6px] border-secondary/40 bg-secondary/8 pl-3 py-2 rounded-r-lg shadow-glow-cosmic">
            <SidebarGroupLabel className="text-secondary font-bold glass-text uppercase tracking-wider text-xs">ธุรกรรม</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {transactionMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className={({ isActive }) =>
                          isActive
                            ? "bg-secondary/20 text-secondary font-bold border-l-2 border-secondary shadow-glow-info glass-text"
                            : "text-foreground/90 hover:bg-secondary/10 hover:text-secondary hover:border-l-2 hover:border-secondary/50 transition-all duration-300 glass-text"
                        }
                      >
                        <item.icon className="mr-2 h-4 w-4 transition-transform duration-300 group-hover:scale-110 drop-shadow-md" />
                        {!isCollapsed && <span className="glass-text">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                
        {/* System Deposit and Withdrawal - Owner only */}
        {showSystemDeposit && (
          <>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <NavLink
                  to="/system-deposit"
                  className={({ isActive }) =>
                    isActive
                      ? "bg-success/30 text-success font-bold shadow-md border-l-4 border-success"
                      : "bg-success/10 hover:bg-success/20 border-l-4 border-success/70 font-semibold text-success shadow-sm hover:shadow-md transition-all"
                  }
                >
                  <Wallet className="mr-2 h-5 w-5 text-success" />
                  {!isCollapsed && (
                    <span className="flex items-center gap-2 text-success">
                      เติมเงินเข้าระบบ
                      <Badge variant="default" className="text-xs px-1.5 py-0 bg-success text-white">Owner</Badge>
                    </span>
                  )}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <NavLink
                  to="/system-withdrawal"
                  className={({ isActive }) =>
                    isActive
                      ? "bg-destructive/30 text-destructive font-bold shadow-md border-l-4 border-destructive"
                      : "bg-destructive/10 hover:bg-destructive/20 border-l-4 border-destructive/70 font-semibold text-destructive shadow-sm hover:shadow-md transition-all"
                  }
                >
                  <ArrowUpFromLine className="mr-2 h-5 w-5 text-destructive" />
                  {!isCollapsed && (
                    <span className="flex items-center gap-2 text-destructive">
                      ถอนเงินออกระบบ
                      <Badge variant="default" className="text-xs px-1.5 py-0 bg-destructive text-white">Owner</Badge>
                    </span>
                  )}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </>
        )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Owner Menu (Tenant Management) - Hidden for Super Admin and Shareholder */}
        {!isSuperAdmin && !isShareholder && ownerMenuItems.length > 0 && (
          <SidebarGroup className="border-l-[6px] border-accent/40 bg-accent/8 pl-3 py-2 rounded-r-lg shadow-glow-cosmic">
            <SidebarGroupLabel className="text-accent font-bold glass-text uppercase tracking-wider text-xs">Organization</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {ownerMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className={({ isActive }) =>
                          isActive
                            ? "bg-accent/20 text-accent font-bold border-l-2 border-accent shadow-glow-info glass-text"
                            : "text-foreground/90 hover:bg-accent/10 hover:text-accent hover:border-l-2 hover:border-accent/50 transition-all duration-300 glass-text"
                        }
                      >
                        <item.icon className="mr-2 h-4 w-4 transition-transform duration-300 group-hover:scale-110 drop-shadow-md" />
                        {!isCollapsed && <span className="glass-text">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Management Menu - Hidden for Super Admin and Shareholder */}
        {!isSuperAdmin && !isShareholder && managementMenuItems.length > 0 && (
          <SidebarGroup className="border-l-[6px] border-warning/40 bg-warning/8 pl-3 py-2 rounded-r-lg shadow-glow-cosmic">
            <SidebarGroupLabel className="text-warning font-bold glass-text uppercase tracking-wider text-xs">Management</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {managementMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className={({ isActive }) =>
                          isActive
                            ? "bg-warning/20 text-warning font-bold border-l-2 border-warning shadow-glow-warning glass-text"
                            : "text-foreground/90 hover:bg-warning/10 hover:text-warning hover:border-l-2 hover:border-warning/50 transition-all duration-300 glass-text"
                        }
                      >
                        <item.icon className="mr-2 h-4 w-4 transition-transform duration-300 group-hover:scale-110 drop-shadow-md" />
                        {!isCollapsed && <span className="glass-text">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Developers Menu - H-3: แยก API/Webhooks/Docs - Hidden for Shareholder */}
        {!isSuperAdmin && !isShareholder && developersMenuItems.length > 0 && (
          <SidebarGroup className="border-l-[6px] border-primary/40 bg-primary/8 pl-3 py-2 rounded-r-lg shadow-glow-cosmic">
            <SidebarGroupLabel className="text-primary font-bold glass-text uppercase tracking-wider text-xs">Developers</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {developersMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className={({ isActive }) =>
                          isActive
                            ? "bg-primary/20 text-primary font-bold border-l-2 border-primary shadow-glow-info glass-text"
                            : "text-foreground/90 hover:bg-primary/10 hover:text-primary hover:border-l-2 hover:border-primary/50 transition-all duration-300 glass-text"
                        }
                      >
                        <item.icon className="mr-2 h-4 w-4 transition-transform duration-300 group-hover:scale-110 drop-shadow-md" />
                        {!isCollapsed && <span className="glass-text">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Settings & Docs - Hidden for Super Admin and Shareholder */}
        {!isSuperAdmin && !isShareholder && (settingsMenuItems.length > 0 || goLiveItems.length > 0) && (
          <SidebarGroup className="border-l-[6px] border-accent/40 bg-accent/8 pl-3 py-2 rounded-r-lg shadow-glow-cosmic">
            <SidebarGroupContent>
              <SidebarMenu>
                {[...settingsMenuItems, ...goLiveItems].map((item) => {
                  const node = (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          className={({ isActive }) =>
                            isActive
                              ? "bg-accent/20 text-accent font-bold border-l-2 border-accent shadow-glow-info glass-text"
                              : "text-foreground/90 hover:bg-accent/10 hover:text-accent hover:border-l-2 hover:border-accent/50 transition-all duration-300 glass-text"
                          }
                        >
                          <item.icon className="mr-2 h-4 w-4 transition-transform duration-300 group-hover:scale-110 drop-shadow-md" />
                          {!isCollapsed && <span className="glass-text">{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                  return (item as any).ownerOnly ? (
                    <PermissionGate allowOwner key={item.title}>{node}</PermissionGate>
                  ) : node;
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isSuperAdmin && (
          <SidebarGroup className="border-l-[6px] border-destructive/40 bg-destructive/8 pl-3 py-2 rounded-r-lg shadow-glow-cosmic">
            <SidebarGroupLabel className="text-destructive font-bold glass-text uppercase tracking-wider text-xs">Super Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {superAdminMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className={({ isActive }) =>
                          isActive
                            ? "bg-destructive/20 text-destructive font-bold border-l-2 border-destructive shadow-glow-warning glass-text"
                            : "text-foreground/90 hover:bg-destructive/10 hover:text-destructive hover:border-l-2 hover:border-destructive/50 transition-all duration-300 glass-text"
                        }
                      >
                        <item.icon className="mr-2 h-4 w-4 transition-transform duration-300 group-hover:scale-110 drop-shadow-md" />
                        {!isCollapsed && <span className="glass-text">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Debug Menu - Available for testing (not for limited role users or shareholder) */}
        {!isSuperAdmin && !isShareholder && (isOwner || hasPermission("api_keys.view")) && (
          <SidebarGroup className="border-l-[6px] border-warning/40 bg-warning/8 pl-3 py-2 rounded-r-lg shadow-glow-cosmic">
            <SidebarGroupLabel className="text-warning font-bold glass-text uppercase tracking-wider text-xs">Debug</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {debugMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className={({ isActive }) =>
                          isActive
                            ? "bg-warning/20 text-warning font-bold border-l-2 border-warning shadow-glow-warning glass-text"
                            : "text-foreground/90 hover:bg-warning/10 hover:text-warning hover:border-l-2 hover:border-warning/50 transition-all duration-300 glass-text"
                        }
                      >
                        <item.icon className="mr-2 h-4 w-4 transition-transform duration-300 group-hover:scale-110 drop-shadow-md" />
                        {!isCollapsed && <span className="glass-text">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <div className="mt-auto p-4 border-t-2 border-primary/20 bg-card/90 backdrop-blur-xl space-y-3 shadow-glow-cosmic">
          {!isCollapsed && (
            <div className="space-y-2 mb-3">
              <p className="text-xs text-muted-foreground glass-text uppercase tracking-wider">Logged in as:</p>
              <p className="text-sm font-bold truncate text-foreground glass-text">{user?.email}</p>
              {isSuperAdmin && (
                <span className="inline-block px-2 py-1 text-xs font-bold rounded-full bg-destructive/20 text-destructive border border-destructive/30 shadow-glow-warning glass-text">
                  Super Admin
                </span>
              )}
            </div>
          )}
          {!isCollapsed && <LocaleSwitcher />}
          <Button
            onClick={signOut}
            variant="destructive"
            className="w-full justify-start glass-text font-bold shadow-glow-warning"
            size={isCollapsed ? "icon" : "default"}
          >
            <LogOut className={isCollapsed ? "" : "mr-2 h-4 w-4"} />
            {!isCollapsed && <span className="glass-text">{t('auth.signOut')}</span>}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
};

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full overflow-x-hidden">
        <DashboardSidebar />
        
        <div className="flex-1 flex flex-col w-full transition-all duration-300 ease-in-out overflow-x-hidden relative">
          <AnimatedBackground />
          <ColorHarmonySelector />
          <header className="h-14 border-b border-border bg-background flex items-center justify-between px-4 gap-4 sticky top-0 z-10 transition-all duration-300">
            <SidebarTrigger className="ml-2" />
          </header>
          
          <main className="relative z-10 flex-1 w-full transition-all duration-300 overflow-x-hidden">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
