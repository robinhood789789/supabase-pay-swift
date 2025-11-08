import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save } from "lucide-react";
import { invokeFunctionWithTenant } from "@/lib/supabaseFunctions";
import { toast } from "sonner";
import { use2FAChallenge } from "@/hooks/use2FAChallenge";
import { TwoFactorChallenge } from "@/components/security/TwoFactorChallenge";

export default function PlatformPartnerSettings() {
  const queryClient = useQueryClient();
  const { isOpen, setIsOpen, checkAndChallenge, onSuccess } = use2FAChallenge();
  const [settings, setSettings] = useState<any>({});

  const { data: currentSettings, isLoading } = useQuery({
    queryKey: ["platform-partner-settings"],
    queryFn: async () => {
      const { data, error } = await invokeFunctionWithTenant("platform-partner-settings-get", {
        body: {},
      });
      if (error) throw error;
      setSettings(data.settings);
      return data.settings;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (newSettings: any) => {
      const { data, error } = await invokeFunctionWithTenant("platform-partner-settings-update", {
        body: { settings: newSettings },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-partner-settings"] });
      toast.success("บันทึกการตั้งค่าสำเร็จ");
    },
    onError: (error: any) => {
      if (error?.code === "MFA_CHALLENGE_REQUIRED") {
        toast.error("ต้องการยืนยัน 2FA");
      } else {
        toast.error("บันทึกล้มเหลว");
      }
    },
  });

  const handleSave = () => {
    checkAndChallenge(() => {
      saveMutation.mutate(settings);
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">ตั้งค่าพาร์ทเนอร์</h1>
            <p className="text-muted-foreground">นโยบาย, เพดาน, และสูตรคำนวณคอมมิชัน</p>
          </div>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            บันทึก (MFA)
          </Button>
        </div>

        <Tabs defaultValue="commission" className="space-y-4">
          <TabsList>
            <TabsTrigger value="commission">คอมมิชัน</TabsTrigger>
            <TabsTrigger value="approval">อนุมัติ</TabsTrigger>
            <TabsTrigger value="self-adjust">Self-Adjust</TabsTrigger>
            <TabsTrigger value="payout">พีเอาต์</TabsTrigger>
          </TabsList>

          <TabsContent value="commission" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>ฐานการคำนวณคอมมิชัน</CardTitle>
                <CardDescription>เลือกว่าคอมมิชันคำนวณจากอะไร</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Revenue Share Base</Label>
                  <Select
                    value={settings.revenue_share_base}
                    onValueChange={(v) => setSettings({ ...settings, revenue_share_base: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="platform_fee">Platform Fee (ค่าธรรมเนียมที่แพลตฟอร์มได้)</SelectItem>
                      <SelectItem value="gross_volume">Gross Volume (ยอดรวมทั้งหมด)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Bounty Trigger</Label>
                  <Select
                    value={settings.bounty_trigger}
                    onValueChange={(v) => setSettings({ ...settings, bounty_trigger: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner_created">เมื่อ Owner สร้างบัญชี</SelectItem>
                      <SelectItem value="first_successful_payment">เมื่อมีการชำระเงินสำเร็จครั้งแรก</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Max Commission % (เพดานสูงสุด)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={settings.max_commission_percent}
                    onChange={(e) =>
                      setSettings({ ...settings, max_commission_percent: parseFloat(e.target.value) })
                    }
                  />
                  <p className="text-sm text-muted-foreground">
                    พาร์ทเนอร์ไม่สามารถตั้งค่าเกิน % นี้ได้
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Settlement Window (วัน)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={settings.settlement_window_days}
                    onChange={(e) =>
                      setSettings({ ...settings, settlement_window_days: parseInt(e.target.value) })
                    }
                  />
                  <p className="text-sm text-muted-foreground">
                    จำนวนวันที่คอมมิชัน pending → available
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="approval" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Approval Rules</CardTitle>
                <CardDescription>กำหนดเงื่อนไขที่ต้องมีการอนุมัติ</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Require Approval Threshold %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={settings.require_approval_threshold_percent}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        require_approval_threshold_percent: parseFloat(e.target.value),
                      })
                    }
                  />
                  <p className="text-sm text-muted-foreground">
                    หากพาร์ทเนอร์ปรับ % เกินนี้ ต้องมีการอนุมัติจาก Super Admin
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="self-adjust" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Self-Adjust Policy</CardTitle>
                <CardDescription>กำหนดให้พาร์ทเนอร์สามารถปรับ % เองได้หรือไม่</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Allow Self-Adjust</Label>
                    <p className="text-sm text-muted-foreground">
                      อนุญาตให้พาร์ทเนอร์ปรับ % เองได้ (ภายในช่วงที่กำหนด)
                    </p>
                  </div>
                  <Switch
                    checked={settings.allow_self_adjust}
                    onCheckedChange={(v) => setSettings({ ...settings, allow_self_adjust: v })}
                  />
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Min % (ต่ำสุด)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      disabled={!settings.allow_self_adjust}
                      value={settings.self_adjust_min_percent}
                      onChange={(e) =>
                        setSettings({ ...settings, self_adjust_min_percent: parseFloat(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max % (สูงสุด)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      disabled={!settings.allow_self_adjust}
                      value={settings.self_adjust_max_percent}
                      onChange={(e) =>
                        setSettings({ ...settings, self_adjust_max_percent: parseFloat(e.target.value) })
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payout" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Payout Controls</CardTitle>
                <CardDescription>กำหนดกฎสำหรับการอนุมัติพีเอาต์</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Dual Control Payout</Label>
                    <p className="text-sm text-muted-foreground">
                      ผู้สร้างคำขอไม่สามารถอนุมัติเองได้
                    </p>
                  </div>
                  <Switch
                    checked={settings.dual_control_payout}
                    onCheckedChange={(v) => setSettings({ ...settings, dual_control_payout: v })}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <TwoFactorChallenge open={isOpen} onOpenChange={setIsOpen} onSuccess={onSuccess} />
    </>
  );
}
