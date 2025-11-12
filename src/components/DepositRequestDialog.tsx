import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invokeFunctionWithTenant } from "@/lib/supabaseFunctions";
import { toast } from "sonner";
import { sanitizeClientError } from "@/lib/security/clientErrorHandling";
import { use2FAChallenge } from "@/hooks/use2FAChallenge";
import { TwoFactorChallenge } from "@/components/security/TwoFactorChallenge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";

export function DepositRequestDialog() {
  const [open, setOpen] = useState(false);
  const { isOpen: mfaOpen, setIsOpen: setMfaOpen, checkAndChallenge, onSuccess } = use2FAChallenge();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("THB");
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();

  const createRequestMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: result, error } = await invokeFunctionWithTenant("deposit-request-create", {
        body: data,
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast.success("คำขอเติมเงินถูกสร้างและส่งไปยัง Owner/Manager เพื่ออนุมัติ");
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      resetForm();
      setOpen(false);
    },
    onError: (error: any) => {
      toast.error("เกิดข้อผิดพลาดในการสร้างคำขอ", { description: sanitizeClientError(error) });
    },
  });

  const resetForm = () => {
    setAmount("");
    setCurrency("THB");
    setMethod("bank_transfer");
    setReference("");
    setNotes("");
    setReason("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("กรุณาใส่จำนวนเงินที่ถูกต้อง");
      return;
    }

    if (!reason.trim()) {
      toast.error("กรุณาระบุเหตุผลในการเติมเงิน");
      return;
    }

    // MFA Challenge before proceeding
    await checkAndChallenge(() => {
      createRequestMutation.mutate({
        amount: Math.round(amountNum * 100),
        currency,
        method,
        reference,
        notes,
        reason,
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
        <Button size="sm" variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          ขอเติมเงิน
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>ขอเติมเงินเข้าระบบ</DialogTitle>
            <DialogDescription>
              สร้างคำขอเติมเงินเพื่อส่งให้ Owner/Manager อนุมัติ
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="req-amount">จำนวนเงิน *</Label>
                <Input
                  id="req-amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="req-currency">สกุลเงิน</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="THB">THB</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="req-method">วิธีการเติม</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">โอนธนาคาร</SelectItem>
                  <SelectItem value="promptpay">พร้อมเพย์</SelectItem>
                  <SelectItem value="cash">เงินสด</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="req-reference">เลขอ้างอิง</Label>
              <Input
                id="req-reference"
                placeholder="เลขอ้างอิงการโอน (ถ้ามี)"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="req-reason">เหตุผล *</Label>
              <Textarea
                id="req-reason"
                placeholder="ระบุเหตุผลในการขอเติมเงิน เช่น เติมเงินสำหรับรับชำระเดือนนี้"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="req-notes">หมายเหตุ</Label>
              <Textarea
                id="req-notes"
                placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={createRequestMutation.isPending}>
              {createRequestMutation.isPending ? "กำลังส่งคำขอ..." : "ส่งคำขอ"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}
