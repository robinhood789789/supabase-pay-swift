import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Receipt, Save } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MDR = () => {
  const { activeTenantId } = useTenantSwitcher();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [feeConfig, setFeeConfig] = useState({
    cardRate: "2.95",
    qrRate: "1.50",
    bankTransferRate: "0.50",
    installmentRate: "3.50",
    fixedFee: "0",
  });

  // Fetch tenant settings and fee plan
  const { data: tenant, isLoading } = useQuery({
    queryKey: ["tenant-fees", activeTenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("fee_plan")
        .eq("id", activeTenantId!)
        .single();

      if (error) throw error;

      // Set fee config from fetched data
      if (data?.fee_plan) {
        const plan = data.fee_plan as any;
        setFeeConfig({
          cardRate: plan.card_rate?.toString() || "2.95",
          qrRate: plan.qr_rate?.toString() || "1.50",
          bankTransferRate: plan.bank_transfer_rate?.toString() || "0.50",
          installmentRate: plan.installment_rate?.toString() || "3.50",
          fixedFee: plan.fixed_fee?.toString() || "0",
        });
      }

      return data;
    },
    enabled: !!activeTenantId,
  });

  // Fetch recent payments to show MDR calculation
  const { data: recentPayments } = useQuery({
    queryKey: ["mdr-payments", activeTenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("tenant_id", activeTenantId!)
        .eq("status", "succeeded")
        .order("paid_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!activeTenantId,
  });

  // Update fee plan mutation
  const updateFeePlan = useMutation({
    mutationFn: async (config: typeof feeConfig) => {
      if (!activeTenantId) throw new Error("No active tenant");

      const { error } = await supabase
        .from("tenants")
        .update({
          fee_plan: {
            card_rate: parseFloat(config.cardRate),
            qr_rate: parseFloat(config.qrRate),
            bank_transfer_rate: parseFloat(config.bankTransferRate),
            installment_rate: parseFloat(config.installmentRate),
            fixed_fee: parseFloat(config.fixedFee),
          },
        })
        .eq("id", activeTenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-fees"] });
      setIsEditing(false);
      toast.success("Fee configuration updated successfully");
    },
    onError: (error: any) => {
      toast.error("Failed to update fee configuration", {
        description: error.message,
      });
    },
  });

  const calculateMDR = (amount: number, method: string) => {
    let rate = 0;
    switch (method) {
      case "card":
        rate = parseFloat(feeConfig.cardRate);
        break;
      case "promptpay":
      case "qr_payment":
        rate = parseFloat(feeConfig.qrRate);
        break;
      case "bank_transfer":
        rate = parseFloat(feeConfig.bankTransferRate);
        break;
      case "installment":
        rate = parseFloat(feeConfig.installmentRate);
        break;
      default:
        rate = 2.0;
    }
    return (amount * rate) / 100 + parseFloat(feeConfig.fixedFee);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
    }).format(amount / 100);
  };

  const handleSave = () => {
    updateFeePlan.mutate(feeConfig);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Receipt className="h-8 w-8" />
              MDR Configuration
            </h1>
            <p className="text-muted-foreground">
              Configure Merchant Discount Rate (MDR) for different payment methods
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Fee Structure</CardTitle>
            <CardDescription>
              Set the fee rates for each payment method (percentage %)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cardRate">Credit/Debit Card Rate (%)</Label>
                <Input
                  id="cardRate"
                  type="number"
                  step="0.01"
                  value={feeConfig.cardRate}
                  onChange={(e) =>
                    setFeeConfig({ ...feeConfig, cardRate: e.target.value })
                  }
                  disabled={!isEditing}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="qrRate">QR Payment / PromptPay Rate (%)</Label>
                <Input
                  id="qrRate"
                  type="number"
                  step="0.01"
                  value={feeConfig.qrRate}
                  onChange={(e) =>
                    setFeeConfig({ ...feeConfig, qrRate: e.target.value })
                  }
                  disabled={!isEditing}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bankTransferRate">Bank Transfer Rate (%)</Label>
                <Input
                  id="bankTransferRate"
                  type="number"
                  step="0.01"
                  value={feeConfig.bankTransferRate}
                  onChange={(e) =>
                    setFeeConfig({ ...feeConfig, bankTransferRate: e.target.value })
                  }
                  disabled={!isEditing}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="installmentRate">Installment Rate (%)</Label>
                <Input
                  id="installmentRate"
                  type="number"
                  step="0.01"
                  value={feeConfig.installmentRate}
                  onChange={(e) =>
                    setFeeConfig({ ...feeConfig, installmentRate: e.target.value })
                  }
                  disabled={!isEditing}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fixedFee">Fixed Fee per Transaction (THB)</Label>
                <Input
                  id="fixedFee"
                  type="number"
                  step="0.01"
                  value={feeConfig.fixedFee}
                  onChange={(e) =>
                    setFeeConfig({ ...feeConfig, fixedFee: e.target.value })
                  }
                  disabled={!isEditing}
                />
              </div>
            </div>

            <div className="flex gap-3">
              {isEditing ? (
                <>
                  <Button onClick={handleSave} disabled={updateFeePlan.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    {updateFeePlan.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button onClick={() => setIsEditing(true)}>Edit Configuration</Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions with MDR</CardTitle>
            <CardDescription>
              MDR calculations based on current fee structure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">MDR Fee</TableHead>
                    <TableHead className="text-right">Net Amount</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : recentPayments?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No transactions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentPayments?.map((payment) => {
                      const mdrFee = calculateMDR(payment.amount, payment.method || "card");
                      const netAmount = payment.amount - mdrFee;

                      return (
                        <TableRow key={payment.id}>
                          <TableCell className="font-mono text-sm">
                            {payment.provider_payment_id?.substring(0, 16)}...
                          </TableCell>
                          <TableCell className="capitalize">
                            {payment.method?.replace("_", " ")}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                          <TableCell className="text-right text-red-500">
                            -{formatCurrency(mdrFee)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(netAmount)}
                          </TableCell>
                          <TableCell>
                            {new Date(payment.paid_at || payment.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default MDR;
