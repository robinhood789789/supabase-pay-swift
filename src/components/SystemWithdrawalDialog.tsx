import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invokeFunctionWithTenant } from "@/lib/supabaseFunctions";
import { toast } from "sonner";
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
import { ArrowUpFromLine, Wallet } from "lucide-react";
import { use2FAChallenge } from "@/hooks/use2FAChallenge";
import { TwoFactorChallenge } from "@/components/security/TwoFactorChallenge";

export function SystemWithdrawalDialog() {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("THB");
  const [method, setMethod] = useState("bank_transfer");
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();
  const { isOpen: mfaOpen, setIsOpen: setMfaOpen, checkAndChallenge, onSuccess } = use2FAChallenge();

  const createWithdrawalMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: result, error } = await invokeFunctionWithTenant("system-withdrawal-create", {
        body: data,
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      return result;
    },
    onSuccess: (data) => {
      if (data.requiresApproval) {
        toast.success("คำขอถอนเงินถูกสร้างและรอการอนุมัติ");
      } else {
        toast.success("ถอนเงินออกจากระบบสำเร็จ");
      }
      queryClient.invalidateQueries({ queryKey: ["tenant_wallets"] });
      queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      resetForm();
      setOpen(false);
    },
    onError: (error: any) => {
      if (error.message?.includes('MFA') || error.message?.includes('2FA')) {
        toast.error("ต้องการการยืนยันตัวตนสองขั้นตอน");
      } else {
        toast.error("เกิดข้อผิดพลาดในการถอนเงิน", { description: error.message });
      }
    },
  });

  const resetForm = () => {
    setAmount("");
    setCurrency("THB");
    setMethod("bank_transfer");
    setBankName("");
    setBankAccountNumber("");
    setBankAccountName("");
    setNotes("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("กรุณาใส่จำนวนเงินที่ถูกต้อง");
      return;
    }

    if (!bankName || !bankAccountNumber || !bankAccountName) {
      toast.error("กรุณากรอกข้อมูลบัญชีธนาคารให้ครบถ้วน");
      return;
    }

    const withdrawalData = {
      amount: Math.round(amountNum * 100), // Convert to smallest unit
      currency,
      method,
      bank_name: bankName,
      bank_account_number: bankAccountNumber,
      bank_account_name: bankAccountName,
      notes,
    };

    // Check MFA before creating withdrawal
    checkAndChallenge(() => {
      createWithdrawalMutation.mutate(withdrawalData);
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button 
            size="lg"
            className="bg-gradient-to-r from-red-600 via-orange-600 to-yellow-500 hover:from-red-700 hover:via-orange-700 hover:to-yellow-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 font-semibold"
          >
            <ArrowUpFromLine className="mr-2 h-5 w-5" />
            ถอนเงินออกจากระบบ
            <Wallet className="ml-2 h-5 w-5" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowUpFromLine className="h-5 w-5 text-red-600" />
                ถอนเงินออกจากระบบ (Owner)
              </DialogTitle>
              <DialogDescription>
                สร้างคำขอถอนเงินจากกระเป๋าเงินของระบบ (ต้องการ 2FA)
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">จำนวนเงิน *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">สกุลเงิน</Label>
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
                <Label htmlFor="method">วิธีการถอน</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">โอนธนาคาร</SelectItem>
                    <SelectItem value="promptpay">พร้อมเพย์</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bankName">ชื่อธนาคาร *</Label>
                <Input
                  id="bankName"
                  placeholder="เช่น ธนาคารกสิกรไทย"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bankAccountNumber">เลขที่บัญชี *</Label>
                  <Input
                    id="bankAccountNumber"
                    placeholder="1234567890"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankAccountName">ชื่อบัญชี *</Label>
                  <Input
                    id="bankAccountName"
                    placeholder="นาย ก"
                    value={bankAccountName}
                    onChange={(e) => setBankAccountName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">หมายเหตุ</Label>
                <Textarea
                  id="notes"
                  placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                ยกเลิก
              </Button>
              <Button 
                type="submit" 
                disabled={createWithdrawalMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {createWithdrawalMutation.isPending ? "กำลังดำเนินการ..." : "ถอนเงิน"}
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
