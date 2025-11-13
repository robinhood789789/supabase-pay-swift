import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Settings } from "lucide-react";
import { toast } from "sonner";
import { use2FAChallenge } from "@/hooks/use2FAChallenge";
import { TwoFactorChallenge } from "@/components/security/TwoFactorChallenge";
import { Link } from "react-router-dom";
import webhookHeroBanner from "@/assets/webhook-hero-banner.jpg";
import DashboardLayout from "@/components/DashboardLayout";
import { RequireTenant } from "@/components/RequireTenant";

export default function WebhookQuickSetup() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const queryClient = useQueryClient();
  const { isOpen, setIsOpen, checkAndChallenge, onSuccess } = use2FAChallenge();
  const { tenantId } = useAuth();

  const createWebhookMutation = useMutation({
    mutationFn: async (url: string) => {
      if (!tenantId) {
        throw new Error("Tenant ID is required");
      }

      // Generate webhook secret using browser crypto
      const secret = crypto.randomUUID();
      
      // Default events for quick setup
      const defaultEvents = [
        "payment.succeeded",
        "payment.failed",
        "payment.pending",
        "refund.created",
        "refund.succeeded",
      ];
      
      const { data, error } = await (supabase as any)
        .from("webhooks")
        .insert({
          tenant_id: tenantId,
          url: url.trim(),
          description: "Quick Setup Webhook",
          events: defaultEvents,
          secret: secret,
          enabled: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      setWebhookUrl("");
      setAgreeToTerms(false);
      toast.success("Webhook สร้างสำเร็จ", {
        description: "คุณจะได้รับการแจ้งเตือนเมื่อมี payment events เกิดขึ้น",
      });
    },
    onError: (error: Error) => {
      toast.error("ไม่สามารถสร้าง webhook ได้", {
        description: error.message,
      });
    },
  });

  const handleSubmit = () => {
    if (!webhookUrl.trim()) {
      toast.error("กรุณากรอก URL");
      return;
    }

    if (!agreeToTerms) {
      toast.error("กรุณายอมรับข้อตกลงการใช้บริการ");
      return;
    }

    try {
      const url = new URL(webhookUrl);
      if (url.protocol !== "https:") {
        toast.error("URL ต้องเป็น HTTPS เท่านั้น");
        return;
      }
    } catch {
      toast.error("กรุณากรอก URL ที่ถูกต้อง");
      return;
    }

    checkAndChallenge(() => createWebhookMutation.mutate(webhookUrl));
  };

  return (
    <RequireTenant>
      <DashboardLayout>
        <div className="container max-w-3xl mx-auto py-8 px-4">
        <Card className="border-0 shadow-lg">
          <CardHeader className="space-y-4">
            {/* Hero Banner */}
            <div className="relative w-full h-48 rounded-lg overflow-hidden mb-4">
              <img 
                src={webhookHeroBanner} 
                alt="Webhook API Integration" 
                className="w-full h-full object-cover"
              />
            </div>

            <div>
              <CardTitle className="text-2xl font-bold">
                บริการเชื่อมการรับเงินผ่าน Webhook API
              </CardTitle>
              <CardDescription className="text-base mt-3">
                เมื่อมีรายการรับเงินโอนจากบัญชีแอปเดอร์กิน หรือเติมเงินผ่านธนาคาร/ช่องทางต่างๆ ระบบจะยิง API (Webhook) แจ้งกลับ/เติมเงิน ไปยัง URL ปลายทางของผู้ใช้งานทันที
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Endpoint URL Input */}
            <div className="space-y-3">
              <Label htmlFor="endpointUrl" className="text-base font-semibold">
                Endpoint URL ที่จะยิงแจ้ง:
              </Label>
              <Input
                id="endpointUrl"
                type="url"
                placeholder="กรอกลิงก์ URL"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                disabled={createWebhookMutation.isPending}
                className="text-base h-12"
              />
            </div>

            {/* Terms Agreement */}
            <div className="flex items-start space-x-3 p-4 bg-muted/30 rounded-lg">
              <Checkbox
                id="terms"
                checked={agreeToTerms}
                onCheckedChange={(checked) => setAgreeToTerms(checked as boolean)}
                disabled={createWebhookMutation.isPending}
                className="mt-1"
              />
              <div className="flex-1">
                <Label htmlFor="terms" className="cursor-pointer text-sm leading-relaxed">
                  ควบคุมข้อมูลการใช้บริการนี้ โดยจะให้ทาง API ให้กับ URL ปลายทางที่กรอกไป แจ้งเตือนเมื่อมีข้อมูลใหม่ ควบคุมความถูกต้องและการตอบรับจากการยิงข้อมูล หรือ รับเงินเมื่อใดก็ตาม ส่งข้อมูลสมบูรณ์ผ่าน webhook นี้ อาจมีความล่าช้าได้ในบางกรณี ดังนั้น ผู้ใช้งานควรตรวจสอบความถูกต้องของการรับเงินจาก
                  <Link to="/transactions-dashboard" className="text-primary hover:underline ml-1">
                    ประวัติการทำรายการ
                  </Link>
                  {" "}เท่านั้น
                </Label>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={createWebhookMutation.isPending || !webhookUrl.trim() || !agreeToTerms}
              className="w-full h-12 text-base font-semibold"
              size="lg"
            >
              {createWebhookMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  กำลังส่งข้อมูล...
                </>
              ) : (
                "ส่งข้อมูล"
              )}
            </Button>

            {/* Advanced Settings Link */}
            <div className="text-center pt-4 border-t">
              <Link 
                to="/settings?tab=webhooks" 
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Settings className="w-4 h-4" />
                ต้องการตั้งค่าขั้นสูง? ไปที่การจัดการ Webhooks
              </Link>
            </div>
          </CardContent>
        </Card>
        </div>

        <TwoFactorChallenge open={isOpen} onOpenChange={setIsOpen} onSuccess={onSuccess} />
      </DashboardLayout>
    </RequireTenant>
  );
}
