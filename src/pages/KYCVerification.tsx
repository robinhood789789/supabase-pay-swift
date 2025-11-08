import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Users, CheckCircle2, XCircle, Clock } from "lucide-react";
import { KYCStatusCard } from "@/components/kyc/KYCStatusCard";
import { KYCDocumentUpload } from "@/components/kyc/KYCDocumentUpload";
import { KYCDocumentsList } from "@/components/kyc/KYCDocumentsList";
import { useAuth } from "@/hooks/useAuth";

const KYCVerification = () => {
  const { user } = useAuth();

  // Fetch KYC statistics
  const { data: stats } = useQuery({
    queryKey: ["kyc-stats"],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from("tenants")
        .select("kyc_level, kyc_status");

      if (error) throw error;

      const total = data?.length || 0;
      const verified = data?.filter((t) => t.kyc_status === "verified").length || 0;
      const pending = data?.filter((t) => t.kyc_status === "pending").length || 0;
      const level3 = data?.filter((t) => t.kyc_level === 3).length || 0;

      return { total, verified, pending, level3 };
    },
    enabled: !!user,
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            KYC Verification
          </h1>
          <p className="text-muted-foreground mt-1">
            จัดการเอกสารยืนยันตัวตนและระดับการยืนยัน
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Merchants ทั้งหมด</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">รอตรวจสอบ</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats?.pending || 0}
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ยืนยันแล้ว</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.verified || 0}
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ระดับ 3</CardTitle>
            <Shield className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats?.level3 || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KYC Status Overview */}
      <KYCStatusCard />

      {/* Document Upload */}
      <div className="grid gap-6 md:grid-cols-1">
        <KYCDocumentUpload />
      </div>

      {/* Documents List */}
      <KYCDocumentsList />

      {/* Security Notice */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="text-blue-900 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            ความปลอดภัยและความเป็นส่วนตัว
          </CardTitle>
          <CardDescription className="text-blue-800">
            ข้อมูลและเอกสารของคุณได้รับการปกป้องด้วยการเข้ารหัสระดับสูง
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-blue-900 space-y-2">
          <p>✓ เอกสารทั้งหมดถูกเข้ารหัสและจัดเก็บอย่างปลอดภัย</p>
          <p>✓ รองรับการยืนยันตัวตนผ่าน Google Authentication</p>
          <p>✓ บันทึกการเข้าถึงและการเปลี่ยนแปลงทั้งหมด (Audit Log)</p>
          <p>✓ ปฏิบัติตามมาตรฐานสากล (ISO 27001, GDPR)</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default KYCVerification;
