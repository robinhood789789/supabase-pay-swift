import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { invokeFunctionWithTenant } from "@/lib/supabaseFunctions";
import { use2FAChallenge } from "@/hooks/use2FAChallenge";
import { TwoFactorChallenge } from "@/components/security/TwoFactorChallenge";

interface EditPartnerCommissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerId: string;
  partnerName: string;
  currentRate: number;
  currentType: string;
}

export function EditPartnerCommissionDialog({
  open,
  onOpenChange,
  partnerId,
  partnerName,
  currentRate,
  currentType,
}: EditPartnerCommissionDialogProps) {
  const [rate, setRate] = useState(currentRate.toString());
  const [commissionType, setCommissionType] = useState(currentType);
  const queryClient = useQueryClient();
  const { isOpen: mfaOpen, setIsOpen: setMfaOpen, checkAndChallenge, onSuccess } = use2FAChallenge();

  const updateCommissionMutation = useMutation({
    mutationFn: async () => {
      const newRate = parseFloat(rate);
      if (isNaN(newRate) || newRate < 0 || newRate > 100) {
        throw new Error("เปอร์เซ็นต์ต้องอยู่ระหว่าง 0-100");
      }

      const { data, error } = await invokeFunctionWithTenant("platform-partner-update-commission", {
        body: {
          partnerId,
          default_commission_type: commissionType,
          default_commission_value: newRate,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("อัปเดตเปอร์เซ็นต์คอมมิชชันสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["platform-partners"] });
      queryClient.invalidateQueries({ queryKey: ["platform-partner-detail", partnerId] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "เกิดข้อผิดพลาดในการอัปเดตเปอร์เซ็นต์");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await checkAndChallenge(async () => {
      await updateCommissionMutation.mutateAsync();
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>แก้ไขเปอร์เซ็นต์คอมมิชชัน</DialogTitle>
            <DialogDescription>
              แก้ไขเปอร์เซ็นต์คอมมิชชันเริ่มต้นของพาร์ทเนอร์ {partnerName}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="commission-type">ประเภทคอมมิชชัน</Label>
                <Select value={commissionType} onValueChange={setCommissionType}>
                  <SelectTrigger id="commission-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revenue_share">Revenue Share</SelectItem>
                    <SelectItem value="bounty">Bounty</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="commission-rate">เปอร์เซ็นต์คอมมิชชัน (%)</Label>
                <Input
                  id="commission-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateCommissionMutation.isPending}
              >
                ยกเลิก
              </Button>
              <Button type="submit" disabled={updateCommissionMutation.isPending}>
                {updateCommissionMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                บันทึก
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <TwoFactorChallenge
        open={mfaOpen}
        onOpenChange={setMfaOpen}
        onSuccess={onSuccess}
      />
    </>
  );
}
