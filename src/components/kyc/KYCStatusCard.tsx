import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Shield, AlertCircle, CheckCircle2 } from "lucide-react";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";

const kycLevelInfo = [
  { level: 0, label: "ไม่ได้ยืนยัน", color: "text-red-600", bg: "bg-red-50" },
  { level: 1, label: "ยืนยันพื้นฐาน", color: "text-yellow-600", bg: "bg-yellow-50" },
  { level: 2, label: "ยืนยันเพิ่มเติม", color: "text-blue-600", bg: "bg-blue-50" },
  { level: 3, label: "ยืนยันเต็มรูปแบบ", color: "text-green-600", bg: "bg-green-50" },
];

export const KYCStatusCard = () => {
  const { activeTenantId } = useTenantSwitcher();

  const { data: tenant } = useQuery({
    queryKey: ["tenant-kyc-status", activeTenantId],
    queryFn: async () => {
      if (!activeTenantId) return null;
      const { data, error } = await supabase
        .from("tenants")
        .select("kyc_level, kyc_status, kyc_verified_at, kyc_notes")
        .eq("id", activeTenantId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!activeTenantId,
  });

  const { data: documentsCount } = useQuery({
    queryKey: ["kyc-documents-count", activeTenantId],
    queryFn: async () => {
      if (!activeTenantId) return { approved: 0, total: 0 };
      const { data, error } = await supabase
        .from("kyc_documents")
        .select("status")
        .eq("tenant_id", activeTenantId);

      if (error) throw error;
      
      const approved = data?.filter((d) => d.status === "approved").length || 0;
      const total = data?.length || 0;
      return { approved, total };
    },
    enabled: !!activeTenantId,
  });

  const kycLevel = tenant?.kyc_level ?? 0;
  const levelInfo = kycLevelInfo[kycLevel];
  const progress = (kycLevel / 3) * 100;

  return (
    <Card className="border-primary/20 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>สถานะการยืนยัน KYC</CardTitle>
              <CardDescription>ระดับการยืนยันตัวตนของคุณ</CardDescription>
            </div>
          </div>
          <Badge className={`${levelInfo.bg} ${levelInfo.color} border-none`}>
            ระดับ {kycLevel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">{levelInfo.label}</span>
            <span className="text-muted-foreground">{progress.toFixed(0)}%</span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">เอกสารที่อนุมัติ</p>
            <p className="text-2xl font-bold text-green-600">
              {documentsCount?.approved || 0}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">เอกสารทั้งหมด</p>
            <p className="text-2xl font-bold">
              {documentsCount?.total || 0}
            </p>
          </div>
        </div>

        {kycLevel < 2 && (
          <div className="flex items-start gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">จำเป็นต้องยืนยันตัวตนเพิ่มเติม</p>
              <p className="text-yellow-700">
                กรุณาอัปโหลดเอกสารเพิ่มเติมเพื่อเพิ่มระดับการยืนยันและปลดล็อคฟีเจอร์เต็มรูปแบบ
              </p>
            </div>
          </div>
        )}

        {kycLevel >= 2 && tenant?.kyc_verified_at && (
          <div className="flex items-start gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-green-800">
              <p className="font-medium mb-1">บัญชีได้รับการยืนยันแล้ว</p>
              <p className="text-green-700">
                ยืนยันเมื่อ {new Date(tenant.kyc_verified_at).toLocaleDateString("th-TH")}
              </p>
            </div>
          </div>
        )}

        {tenant?.kyc_notes && (
          <div className="text-sm p-3 bg-muted rounded-lg">
            <p className="font-medium mb-1">หมายเหตุจากระบบ:</p>
            <p className="text-muted-foreground">{tenant.kyc_notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
