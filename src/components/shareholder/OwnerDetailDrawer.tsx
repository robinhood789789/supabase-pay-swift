import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Building2, Calendar, Mail, Shield, Activity, CreditCard } from "lucide-react";

interface OwnerDetailDrawerProps {
  tenantId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OwnerDetailDrawer({ tenantId, open, onOpenChange }: OwnerDetailDrawerProps) {
  const { data: tenantDetails, isLoading } = useQuery({
    queryKey: ["tenant-details", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .select(`
          *,
          tenant_wallets (
            balance
          ),
          tenant_settings (
            provider
          )
        `)
        .eq("id", tenantId)
        .single();

      if (tenantError) throw tenantError;

      // Get recent payments count
      const { count: paymentsCount } = await supabase
        .from("payments")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId);

      // Get recent activity
      const { data: recentPayments } = await supabase
        .from("payments")
        .select("created_at, amount, status")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(5);

      return {
        ...tenant,
        payments_count: paymentsCount || 0,
        recent_payments: recentPayments || [],
      };
    },
    enabled: !!tenantId && open,
  });

  if (isLoading) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  if (!tenantDetails) return null;

  const balance = tenantDetails.tenant_wallets?.[0]?.balance || 0;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-2xl mx-auto max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {tenantDetails.name || "ไม่ระบุชื่อธุรกิจ"}
          </DrawerTitle>
          <DrawerDescription>
            รายละเอียดบัญชี Owner และข้อมูลการใช้งาน
          </DrawerDescription>
        </DrawerHeader>

        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Status Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">สถานะบัญชี</h3>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={tenantDetails.status === "active" ? "default" : "secondary"}
                className={
                  tenantDetails.status === "active"
                    ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0"
                    : ""
                }
              >
                {tenantDetails.status === "active" ? "ใช้งาน" : "ไม่ใช้งาน"}
              </Badge>
              <Badge
                variant={tenantDetails.kyc_status === "verified" ? "default" : "secondary"}
                className={
                  tenantDetails.kyc_status === "verified"
                    ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0"
                    : ""
                }
              >
                KYC: {tenantDetails.kyc_status || "pending"}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Business Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">ข้อมูลธุรกิจ</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ชื่อธุรกิจ</p>
                  <p className="text-sm font-medium">{tenantDetails.name || "-"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
                  <Shield className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tenant ID</p>
                  <p className="text-sm font-medium font-mono text-xs">{tenantDetails.id.slice(0, 8)}...</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                  <CreditCard className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ยอดคงเหลือ</p>
                  <p className="text-sm font-medium">
                    ฿{(balance / 100).toLocaleString("th-TH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <Activity className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ธุรกรรมทั้งหมด</p>
                  <p className="text-sm font-medium">{tenantDetails.payments_count} รายการ</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Dates */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">วันที่สำคัญ</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                  <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">วันที่สร้างบัญชี</p>
                  <p className="text-sm font-medium">
                    {new Date(tenantDetails.created_at).toLocaleDateString("th-TH", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          {tenantDetails.recent_payments && tenantDetails.recent_payments.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">กิจกรรมล่าสุด</h3>
                <div className="space-y-2">
                  {tenantDetails.recent_payments.map((payment: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-primary/10">
                          <Activity className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            ฿{(payment.amount / 100).toLocaleString("th-TH")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(payment.created_at).toLocaleDateString("th-TH")}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={payment.status === "succeeded" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {payment.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
