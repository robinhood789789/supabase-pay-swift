import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { invokeFunctionWithTenant } from "@/lib/supabaseFunctions";
import { usePermissions } from "@/hooks/usePermissions";
import { use2FAChallenge } from "@/hooks/use2FAChallenge";
import { TwoFactorChallenge } from "@/components/security/TwoFactorChallenge";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  provider: string | null;
  provider_payment_id: string | null;
  checkout_session_id: string | null;
  created_at: string;
  paid_at: string | null;
  metadata: any;
}

interface PaymentDetailsDrawerProps {
  payment: Payment | null;
  open: boolean;
  onClose: () => void;
}

export const PaymentDetailsDrawer = ({ payment, open, onClose }: PaymentDetailsDrawerProps) => {
  const { hasPermission } = usePermissions();
  const { activeTenant } = useTenantSwitcher();
  const userRole = activeTenant?.roles?.name;
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [isRefunding, setIsRefunding] = useState(false);
  
  const { isOpen: mfaOpen, setIsOpen: setMfaOpen, checkAndChallenge, onSuccess } = use2FAChallenge();

  if (!payment) return null;
  
  const canRefund = hasPermission("refunds:create") || 
                    userRole === "owner" || 
                    userRole === "finance" || 
                    userRole === "manager";

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "succeeded": return "default";
      case "pending": return "secondary";
      case "failed": return "destructive";
      default: return "outline";
    }
  };

  const processRefundAction = async () => {
    if (!payment) return;

    setIsRefunding(true);
    try {
      const amount = refundAmount ? parseFloat(refundAmount) * 100 : payment.amount;
      
      const { data, error } = await invokeFunctionWithTenant("refunds-create", {
        body: {
          paymentId: payment.id,
          amount,
          reason: refundReason || undefined
        }
      });

      if (error) throw error;

      toast.success("Refund initiated successfully");
      setRefundDialogOpen(false);
      setRefundAmount("");
      setRefundReason("");
      onClose();
    } catch (error) {
      console.error("Refund error:", error);
      toast.error("Failed to process refund");
    } finally {
      setIsRefunding(false);
    }
  };

  const handleRefund = async () => {
    await checkAndChallenge(processRefundAction);
  };

  const handleMfaSuccess = () => {
    setMfaOpen(false);
    onSuccess();
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Payment Details</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Amount</span>
              <span className="text-2xl font-bold">
                {(payment.amount / 100).toLocaleString()} {payment.currency.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant={getStatusColor(payment.status)}>{payment.status}</Badge>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Payment ID</span>
              <div className="flex items-center gap-2">
                <code className="text-xs">{payment.id.slice(0, 8)}...</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => copyToClipboard(payment.id, "Payment ID")}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {payment.provider_payment_id && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Provider ID</span>
                <div className="flex items-center gap-2">
                  <code className="text-xs">{payment.provider_payment_id.slice(0, 12)}...</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => copyToClipboard(payment.provider_payment_id!, "Provider ID")}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}

            {payment.checkout_session_id && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Session ID</span>
                <div className="flex items-center gap-2">
                  <code className="text-xs">{payment.checkout_session_id.slice(0, 8)}...</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => copyToClipboard(payment.checkout_session_id!, "Session ID")}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}

            {payment.method && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Method</span>
                <span className="text-sm font-medium">{payment.method}</span>
              </div>
            )}

            {payment.provider && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Provider</span>
                <span className="text-sm font-medium">{payment.provider}</span>
              </div>
            )}
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Created</span>
              <span className="text-sm">{format(new Date(payment.created_at), "PPp")}</span>
            </div>

            {payment.paid_at && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Paid</span>
                <span className="text-sm">{format(new Date(payment.paid_at), "PPp")}</span>
              </div>
            )}
          </div>

          {payment.metadata && Object.keys(payment.metadata).length > 0 && (
            <div className="space-y-2 border-t pt-4">
              <span className="text-sm font-medium">Metadata</span>
              <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
                {JSON.stringify(payment.metadata, null, 2)}
              </pre>
            </div>
          )}

          {payment.status === "succeeded" && canRefund && (
            <div className="border-t pt-4">
              <Button 
                variant="destructive" 
                className="w-full gap-2"
                onClick={() => setRefundDialogOpen(true)}
              >
                <RefreshCw className="h-4 w-4" />
                Process Refund
              </Button>
            </div>
          )}
        </div>
      </SheetContent>

      <TwoFactorChallenge
        open={mfaOpen}
        onOpenChange={setMfaOpen}
        onSuccess={handleMfaSuccess}
        title="Verify Refund Action"
        description="Please enter your 2FA code to authorize this refund transaction."
      />

      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Refund</DialogTitle>
            <DialogDescription>
              Issue a full or partial refund for this payment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="refund-amount">Amount ({payment.currency.toUpperCase()})</Label>
              <Input
                id="refund-amount"
                type="number"
                step="0.01"
                placeholder={`Leave empty for full refund (${(payment.amount / 100).toLocaleString()})`}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                max={payment.amount / 100}
              />
              <p className="text-xs text-muted-foreground">
                Maximum: {(payment.amount / 100).toLocaleString()} {payment.currency.toUpperCase()}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="refund-reason">Reason (Optional)</Label>
              <Textarea
                id="refund-reason"
                placeholder="Enter reason for refund..."
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setRefundDialogOpen(false)}
              disabled={isRefunding}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleRefund}
              disabled={isRefunding}
            >
              {isRefunding ? "Processing..." : "Confirm Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
};
