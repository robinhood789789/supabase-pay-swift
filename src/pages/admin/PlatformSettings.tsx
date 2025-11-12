import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { use2FAChallenge } from "@/hooks/use2FAChallenge";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, AlertCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { TwoFactorChallenge } from "@/components/security/TwoFactorChallenge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

interface PlatformSettings {
  default_fee_percentage: number;
  default_fee_fixed: number;
  maintenance_mode: boolean;
  maintenance_message: string;
  new_tenant_auto_approve: boolean;
  webhook_retry_max: number;
  webhook_retry_backoff_seconds: number;
}

const PlatformSettings = () => {
  const { user, isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PlatformSettings>({
    default_fee_percentage: 2.9,
    default_fee_fixed: 3.0,
    maintenance_mode: false,
    maintenance_message: "ระบบอยู่ระหว่างการปรับปรุง กรุณากลับมาใหม่ภายหลัง",
    new_tenant_auto_approve: false,
    webhook_retry_max: 5,
    webhook_retry_backoff_seconds: 300,
  });
  const { isOpen, setIsOpen, checkAndChallenge, onSuccess } = use2FAChallenge();

  useEffect(() => {
    if (!user || !isSuperAdmin) return;

    // Audit: Page view
    supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "platform.settings.view",
      target_type: "platform_settings",
      ip_address: "",
      user_agent: navigator.userAgent,
    });

    loadSettings();
  }, [user, isSuperAdmin]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("platform-settings-get");
      
      if (error) throw error;
      
      if (data?.settings) {
        setSettings({
          default_fee_percentage: data.settings.default_fee_percentage?.value || 2.9,
          default_fee_fixed: data.settings.default_fee_fixed?.value || 3.0,
          maintenance_mode: data.settings.maintenance_mode?.enabled || false,
          maintenance_message: data.settings.maintenance_mode?.message || "ระบบอยู่ระหว่างการปรับปรุง กรุณากลับมาใหม่ภายหลัง",
          new_tenant_auto_approve: data.settings.new_tenant_auto_approve?.enabled || false,
          webhook_retry_max: data.settings.webhook_retry_max?.value || 5,
          webhook_retry_backoff_seconds: data.settings.webhook_retry_backoff_seconds?.value || 300,
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("ไม่สามารถโหลดการตั้งค่าได้");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    await checkAndChallenge(async () => {
      setSaving(true);
      try {
        const settingsToSave = {
          default_fee_percentage: { value: settings.default_fee_percentage },
          default_fee_fixed: { value: settings.default_fee_fixed },
          maintenance_mode: { 
            enabled: settings.maintenance_mode, 
            message: settings.maintenance_message 
          },
          new_tenant_auto_approve: { enabled: settings.new_tenant_auto_approve },
          webhook_retry_max: { value: settings.webhook_retry_max },
          webhook_retry_backoff_seconds: { value: settings.webhook_retry_backoff_seconds },
        };

        const { error } = await supabase.functions.invoke("platform-settings-update", {
          body: { settings: settingsToSave },
        });

        if (error) throw error;

        toast.success("บันทึกการตั้งค่าสำเร็จ");
      } catch (error) {
        console.error("Error saving settings:", error);
        toast.error("ไม่สามารถบันทึกการตั้งค่าได้");
      } finally {
        setSaving(false);
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-foreground" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>คุณไม่มีสิทธิ์เข้าถึงหน้านี้</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6 bg-white min-h-screen">
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-medium text-black tracking-tight">Platform Settings</h1>
        <p className="text-gray-600">จัดการการตั้งค่า fees, feature flags, และ maintenance mode</p>
      </div>

      <Alert className="border-gray-300 bg-white">
        <AlertCircle className="h-4 w-4 text-gray-700" />
        <AlertDescription className="text-gray-700">
          ⚠️ การเปลี่ยนแปลงการตั้งค่าต้องการ MFA ทุกครั้ง
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="fees" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-gray-50 border border-gray-200">
          <TabsTrigger value="fees" className="data-[state=active]:bg-white data-[state=active]:text-black">Fees & Billing</TabsTrigger>
          <TabsTrigger value="features" className="data-[state=active]:bg-white data-[state=active]:text-black">Feature Flags</TabsTrigger>
          <TabsTrigger value="maintenance" className="data-[state=active]:bg-white data-[state=active]:text-black">Maintenance</TabsTrigger>
        </TabsList>

        <TabsContent value="fees">
          <Card className="border border-gray-200 bg-white">
            <CardHeader>
              <CardTitle className="text-black font-medium tracking-tight">Default Fee Structure</CardTitle>
              <CardDescription className="text-gray-600">ค่า fees เริ่มต้นสำหรับ tenant ใหม่</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-700 uppercase tracking-wider">Percentage Fee (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={settings.default_fee_percentage}
                  onChange={(e) =>
                    setSettings({ ...settings, default_fee_percentage: parseFloat(e.target.value) })
                  }
                  className="border-gray-300 bg-white text-black"
                />
                <p className="text-sm text-gray-500">ค่า fee เป็นเปอร์เซ็นต์ (เช่น 2.9%)</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-700 uppercase tracking-wider">Fixed Fee (THB)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={settings.default_fee_fixed}
                  onChange={(e) =>
                    setSettings({ ...settings, default_fee_fixed: parseFloat(e.target.value) })
                  }
                  className="border-gray-300 bg-white text-black"
                />
                <p className="text-sm text-gray-500">ค่า fee คงที่ต่อ transaction (เช่น 3 บาท)</p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Webhook Retry Max Attempts</Label>
                <Input
                  type="number"
                  value={settings.webhook_retry_max}
                  onChange={(e) =>
                    setSettings({ ...settings, webhook_retry_max: parseInt(e.target.value) })
                  }
                />
                <p className="text-sm text-muted-foreground">จำนวนครั้งที่จะ retry webhook สูงสุด</p>
              </div>

              <div className="space-y-2">
                <Label>Webhook Retry Backoff (seconds)</Label>
                <Input
                  type="number"
                  value={settings.webhook_retry_backoff_seconds}
                  onChange={(e) =>
                    setSettings({ ...settings, webhook_retry_backoff_seconds: parseInt(e.target.value) })
                  }
                />
                <p className="text-sm text-muted-foreground">ระยะเวลารอก่อน retry webhook (วินาที)</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features">
          <Card>
            <CardHeader>
              <CardTitle>Feature Flags</CardTitle>
              <CardDescription>เปิด/ปิด features สำหรับ platform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-approve New Tenants</Label>
                  <p className="text-sm text-muted-foreground">
                    อนุมัติ tenant ใหม่อัตโนมัติโดยไม่ต้อง manual review
                  </p>
                </div>
                <Switch
                  checked={settings.new_tenant_auto_approve}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, new_tenant_auto_approve: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Mode</CardTitle>
              <CardDescription>เปิด/ปิด maintenance mode สำหรับทั้ง platform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Maintenance Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    เมื่อเปิด users จะไม่สามารถเข้าใช้งานได้
                  </p>
                </div>
                <Switch
                  checked={settings.maintenance_mode}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, maintenance_mode: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Maintenance Message</Label>
                <Input
                  value={settings.maintenance_message}
                  onChange={(e) =>
                    setSettings({ ...settings, maintenance_message: e.target.value })
                  }
                  placeholder="ข้อความที่จะแสดงเมื่อ maintenance mode เปิดอยู่"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-black text-white hover:bg-gray-800 border-0">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="mr-2 h-4 w-4" />
          บันทึกการตั้งค่า
        </Button>
      </div>

      <TwoFactorChallenge
        open={isOpen}
        onOpenChange={setIsOpen}
        onSuccess={onSuccess}
      />
    </div>
  );
};

export default PlatformSettings;
