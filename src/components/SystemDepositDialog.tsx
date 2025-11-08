import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { use2FAChallenge } from "@/hooks/use2FAChallenge";
import { TwoFactorChallenge } from "@/components/security/TwoFactorChallenge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invokeFunctionWithTenant } from "@/lib/supabaseFunctions";
import { useI18n } from "@/lib/i18n";

export default function SystemDepositDialog() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { isOpen: mfaOpen, setIsOpen: setMfaOpen, checkAndChallenge, onSuccess } = use2FAChallenge();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("THB");
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  const createDepositMutation = useMutation({
    mutationFn: async (data: {
      amount: number;
      currency: string;
      method: string;
      reference?: string;
      notes?: string;
    }) => {
      const { data: result, error } = await invokeFunctionWithTenant(
        "system-deposit-create",
        { body: data }
      );

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast.success("เติมเงินสำเร็จ", {
        description: "ยอดเงินได้ถูกเพิ่มเข้าระบบแล้ว",
      });
      queryClient.invalidateQueries({ queryKey: ["system-deposits"] });
      queryClient.invalidateQueries({ queryKey: ["tenant-wallet"] });
      setOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error("เติมเงินไม่สำเร็จ", {
        description: error.message || "กรุณาลองใหม่อีกครั้ง",
      });
    },
  });

  const resetForm = () => {
    setAmount("");
    setCurrency("THB");
    setMethod("bank_transfer");
    setReference("");
    setNotes("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("กรุณากรอกจำนวนเงินที่ถูกต้อง");
      return;
    }

    // Convert to smallest currency unit (cents/satang)
    const amountInCents = Math.round(amountNum * 100);

    // MFA Challenge before proceeding
    const canProceed = await checkAndChallenge(() => {
      createDepositMutation.mutate({
        amount: amountInCents,
        currency,
        method,
        reference: reference || undefined,
        notes: notes || undefined,
      });
    });
  };

  return (
    <>
      <TwoFactorChallenge
        open={mfaOpen}
        onOpenChange={setMfaOpen}
        onSuccess={onSuccess}
      />
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2 bg-success hover:bg-success/90">
          <PlusCircle className="h-5 w-5" />
          เติมเงินเข้าระบบ
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>เติมเงินเข้าระบบ</DialogTitle>
          <DialogDescription>
            เพิ่มยอดเงินเข้า Wallet ขององค์กร
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">จำนวนเงิน *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="1000.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">สกุลเงิน *</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger id="currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="THB">THB (บาท)</SelectItem>
                <SelectItem value="USD">USD (ดอลลาร์)</SelectItem>
                <SelectItem value="EUR">EUR (ยูโร)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="method">วิธีการชำระ *</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger id="method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">โอนผ่านธนาคาร</SelectItem>
                <SelectItem value="cash">เงินสด</SelectItem>
                <SelectItem value="check">เช็ค</SelectItem>
                <SelectItem value="other">อื่นๆ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">เลขอ้างอิง / Transaction ID</Label>
            <Input
              id="reference"
              placeholder="TXN-2024-001"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">หมายเหตุ</Label>
            <Textarea
              id="notes"
              placeholder="ระบุรายละเอียดเพิ่มเติม..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
              disabled={createDepositMutation.isPending}
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={createDepositMutation.isPending}
            >
              {createDepositMutation.isPending ? "กำลังดำเนินการ..." : "ยืนยันเติมเงิน"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}
