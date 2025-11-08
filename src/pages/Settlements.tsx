import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { RequireTenant } from "@/components/RequireTenant";
import { PermissionGate } from "@/components/PermissionGate";
import { SettlementsTable } from "@/components/SettlementsTable";
import { SettlementsSummary } from "@/components/SettlementsSummary";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invokeFunctionWithTenant } from "@/lib/supabaseFunctions";
import { use2FAChallenge } from "@/hooks/use2FAChallenge";
import { TwoFactorChallenge } from "@/components/security/TwoFactorChallenge";

const Settlements = () => {
  const { t } = useI18n();
  const { activeTenantId, activeTenant } = useTenantSwitcher();
  const queryClient = useQueryClient();
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false); // H-11
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");
  const { isOpen, setIsOpen, checkAndChallenge, onSuccess } = use2FAChallenge(); // H-11: MFA
  
  const isOwner = activeTenant?.roles?.name === 'owner';
  const isManager = activeTenant?.roles?.name === 'manager';
  const isFinance = activeTenant?.roles?.name === 'finance';

  // Fetch all settlements for summary
  const { data: allSettlements = [], isLoading } = useQuery({
    queryKey: ["settlements-summary", activeTenantId],
    queryFn: async () => {
      if (!activeTenantId) return [];
      const { data, error } = await supabase
        .from("settlements")
        .select("*")
        .eq("tenant_id", activeTenantId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeTenantId,
  });

  // H-11: On-demand payout request mutation
  const requestPayoutMutation = useMutation({
    mutationFn: async (data: { amount: number; notes: string }) => {
      const { data: result, error } = await invokeFunctionWithTenant("approvals-create", {
        body: {
          action_type: "payout_request",
          action_data: {
            amount: data.amount,
            notes: data.notes,
            requested_at: new Date().toISOString(),
          },
        },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settlements-summary"] });
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      toast.success("Payout request submitted for approval");
      setPayoutDialogOpen(false);
      setPayoutAmount("");
      setPayoutNotes("");
    },
    onError: (error: any) => {
      toast.error("Failed to request payout", { description: error.message });
    },
  });

  const handleRequestPayout = () => {
    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("กรุณากรอกจำนวนเงินที่ถูกต้อง");
      return;
    }

    // MFA challenge before creating payout request
    checkAndChallenge(() => 
      requestPayoutMutation.mutate({ 
        amount: Math.round(amount * 100), 
        notes: payoutNotes 
      })
    );
  };
  
  return (
    <DashboardLayout>
      <RequireTenant>
        <div className="p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">{t('settlements.title')}</h1>
                <p className="text-muted-foreground mt-1">{t('settlements.viewManage')}</p>
              </div>
              {/* H-11: On-demand payout request button */}
              {(isManager || isFinance) && (
                <Dialog open={payoutDialogOpen} onOpenChange={setPayoutDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <DollarSign className="h-4 w-4" />
                      Request Payout
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Request On-Demand Payout</DialogTitle>
                      <DialogDescription>
                        Create a payout request that requires Owner approval (MFA required)
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="payoutAmount">Amount (THB)</Label>
                        <Input
                          id="payoutAmount"
                          type="number"
                          step="0.01"
                          placeholder="10000.00"
                          value={payoutAmount}
                          onChange={(e) => setPayoutAmount(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="payoutNotes">Notes / Reason</Label>
                        <Textarea
                          id="payoutNotes"
                          placeholder="Reason for payout request..."
                          value={payoutNotes}
                          onChange={(e) => setPayoutNotes(e.target.value)}
                          rows={3}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setPayoutDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleRequestPayout}
                        disabled={requestPayoutMutation.isPending}
                      >
                        {requestPayoutMutation.isPending ? "Submitting..." : "Submit Request"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <PermissionGate 
              permission="payments.read"
              fallback={
                <div className="text-center p-12 border rounded-lg bg-muted/20">
                  <p className="text-muted-foreground">{t('settlements.noPermission')}</p>
                </div>
              }
            >
              {isLoading ? (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-32 w-full" />
                    ))}
                  </div>
                  <Skeleton className="h-96 w-full" />
                </div>
              ) : (
                <div className="space-y-6">
                  <SettlementsSummary settlements={allSettlements} />
                  <SettlementsTable />
                </div>
              )}
            </PermissionGate>
          </div>
        </div>

        <TwoFactorChallenge open={isOpen} onOpenChange={setIsOpen} onSuccess={onSuccess} />
      </RequireTenant>
    </DashboardLayout>
  );
};

export default Settlements;
