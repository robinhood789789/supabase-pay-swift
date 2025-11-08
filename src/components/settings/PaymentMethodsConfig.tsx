import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreditCard, Wallet, Building2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { use2FAChallenge } from "@/hooks/use2FAChallenge";
import { TwoFactorChallenge } from "../security/TwoFactorChallenge";

const PAYMENT_METHODS = [
  { type: "card", label: "Credit/Debit Card", icon: CreditCard },
  { type: "promptpay", label: "PromptPay", icon: QrCode },
  { type: "truemoney", label: "TrueMoney Wallet", icon: Wallet },
  { type: "bank_transfer", label: "Bank Transfer", icon: Building2 },
  { type: "installment", label: "Installment", icon: CreditCard },
  { type: "qr_payment", label: "QR Payment", icon: QrCode },
];

const PROVIDERS = [
  { value: "stripe", label: "Stripe" },
  { value: "opn", label: "Omise/OPN" },
  { value: "twoc2p", label: "2C2P" },
  { value: "kbank", label: "K-PaymentGateway" },
];

export default function PaymentMethodsConfig() {
  const { activeTenantId } = useTenantSwitcher();
  const queryClient = useQueryClient();
  const { isOpen, setIsOpen, checkAndChallenge, onSuccess } = use2FAChallenge(); // H-7: MFA

  // Fetch tenant settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["tenant-settings", activeTenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_settings")
        .select("*")
        .eq("tenant_id", activeTenantId!)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!activeTenantId,
  });

  // Fetch payment methods
  const { data: paymentMethods } = useQuery({
    queryKey: ["payment-methods", activeTenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("tenant_id", activeTenantId!)
        .order("type");

      if (error) throw error;
      return data;
    },
    enabled: !!activeTenantId,
  });

  // Update provider mutation - H-7: เพิ่ม MFA
  const updateProvider = useMutation({
    mutationFn: async (provider: string) => {
      if (!activeTenantId) throw new Error("No active tenant");

      const { error } = await supabase
        .from("tenant_settings")
        .update({ provider })
        .eq("tenant_id", activeTenantId);

      if (error) throw error;

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: activeTenantId,
        action: 'payment_methods.provider.update',
        target: 'tenant_settings',
        after: { provider }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-settings"] });
      toast.success("Payment provider updated");
    },
    onError: (error: any) => {
      toast.error("Failed to update provider", {
        description: error.message,
      });
    },
  });

  // Toggle payment method mutation - H-7: เพิ่ม MFA
  const toggleMethod = useMutation({
    mutationFn: async ({ type, enabled }: { type: string; enabled: boolean }) => {
      if (!activeTenantId) throw new Error("No active tenant");

      const existing = paymentMethods?.find((m) => m.type === type);

      if (existing) {
        const { error } = await supabase
          .from("payment_methods")
          .update({ enabled })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("payment_methods")
          .insert({
            tenant_id: activeTenantId,
            type,
            enabled,
            config: {},
          });

        if (error) throw error;
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: activeTenantId,
        action: enabled ? 'payment_methods.enable' : 'payment_methods.disable',
        target: type,
        after: { type, enabled }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
      toast.success("Payment method updated");
    },
    onError: (error: any) => {
      toast.error("Failed to update payment method", {
        description: error.message,
      });
    },
  });

  const isMethodEnabled = (type: string) => {
    return paymentMethods?.find((m) => m.type === type)?.enabled || false;
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Payment Provider</CardTitle>
          <CardDescription>
            Select your payment gateway provider
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select
              value={settings?.provider || "stripe"}
              onValueChange={(value) => checkAndChallenge(() => updateProvider.mutate(value))}
              disabled={updateProvider.isPending}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((provider) => (
                  <SelectItem key={provider.value} value={provider.value}>
                    {provider.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline">{settings?.provider || "stripe"}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment Methods</CardTitle>
          <CardDescription>
            Enable or disable payment methods for your customers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {PAYMENT_METHODS.map((method) => {
              const Icon = method.icon;
              const enabled = isMethodEnabled(method.type);

              return (
                <div
                  key={method.type}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{method.label}</div>
                      <div className="text-sm text-muted-foreground">
                        {method.type}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {enabled && <Badge variant="outline">Active</Badge>}
                    <Switch
                      checked={enabled}
                      onCheckedChange={(checked) =>
                        checkAndChallenge(() => toggleMethod.mutate({ type: method.type, enabled: checked }))
                      }
                      disabled={toggleMethod.isPending}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <TwoFactorChallenge open={isOpen} onOpenChange={setIsOpen} onSuccess={onSuccess} />
    </div>
  );
}
