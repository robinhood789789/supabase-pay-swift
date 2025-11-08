import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useShareholder } from "@/hooks/useShareholder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { Wallet } from "lucide-react";

export default function ShareholderWithdrawals() {
  const { shareholder } = useShareholder();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    amount: "",
    bankName: "",
    bankAccountNumber: "",
    bankAccountName: "",
    notes: "",
  });

  const { data: withdrawals, isLoading } = useQuery({
    queryKey: ["shareholder-withdrawals", shareholder?.id],
    queryFn: async () => {
      if (!shareholder?.id) return [];

      const { data, error } = await supabase
        .from("shareholder_withdrawals")
        .select("*")
        .eq("shareholder_id", shareholder.id)
        .order("requested_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!shareholder?.id,
  });

  const createWithdrawalMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!shareholder?.id) throw new Error("No shareholder ID");

      const amount = parseFloat(data.amount);
      if (amount > shareholder.balance) {
        throw new Error("ยอดเงินไม่เพียงพอ");
      }

      const { error } = await supabase
        .from("shareholder_withdrawals")
        .insert({
          shareholder_id: shareholder.id,
          amount: Math.round(amount * 100), // Convert to cents
          bank_name: data.bankName,
          bank_account_number: data.bankAccountNumber,
          bank_account_name: data.bankAccountName,
          notes: data.notes,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shareholder-withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["shareholder"] });
      toast.success("ส่งคำขอถอนเงินสำเร็จ");
      setIsDialogOpen(false);
      setFormData({
        amount: "",
        bankName: "",
        bankAccountNumber: "",
        bankAccountName: "",
        notes: "",
      });
    },
    onError: (error: any) => {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createWithdrawalMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">ถอนเงิน</h1>
          <p className="text-muted-foreground mt-2">
            จัดการการถอนเงินของคุณ
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Wallet className="h-4 w-4 mr-2" />
              ขอถอนเงิน
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ขอถอนเงิน</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>ยอดเงินคงเหลือ</Label>
                <div className="text-2xl font-bold text-primary">
                  {formatCurrency(shareholder?.balance || 0)}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">จำนวนเงินที่ต้องการถอน (บาท)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bankName">ธนาคาร</Label>
                <Input
                  id="bankName"
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bankAccountNumber">เลขที่บัญชี</Label>
                <Input
                  id="bankAccountNumber"
                  value={formData.bankAccountNumber}
                  onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bankAccountName">ชื่อบัญชี</Label>
                <Input
                  id="bankAccountName"
                  value={formData.bankAccountName}
                  onChange={(e) => setFormData({ ...formData, bankAccountName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">หมายเหตุ (ถ้ามี)</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
              <Button
                type="submit"
                disabled={createWithdrawalMutation.isPending}
                className="w-full"
              >
                {createWithdrawalMutation.isPending ? "กำลังส่งคำขอ..." : "ส่งคำขอถอนเงิน"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ประวัติการถอนเงิน</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>วันที่ขอ</TableHead>
                <TableHead>จำนวนเงิน</TableHead>
                <TableHead>ธนาคาร</TableHead>
                <TableHead>เลขที่บัญชี</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>วันที่อนุมัติ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {withdrawals && withdrawals.length > 0 ? (
                withdrawals.map((withdrawal: any) => (
                  <TableRow key={withdrawal.id}>
                    <TableCell>
                      {new Date(withdrawal.requested_at).toLocaleDateString("th-TH")}
                    </TableCell>
                    <TableCell className="font-bold">
                      {formatCurrency(withdrawal.amount)}
                    </TableCell>
                    <TableCell>{withdrawal.bank_name}</TableCell>
                    <TableCell>{withdrawal.bank_account_number}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          withdrawal.status === "completed"
                            ? "default"
                            : withdrawal.status === "approved"
                            ? "secondary"
                            : withdrawal.status === "rejected"
                            ? "destructive"
                            : "outline"
                        }
                      >
                        {withdrawal.status === "completed"
                          ? "เสร็จสิ้น"
                          : withdrawal.status === "approved"
                          ? "อนุมัติแล้ว"
                          : withdrawal.status === "rejected"
                          ? "ปฏิเสธ"
                          : "รออนุมัติ"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {withdrawal.approved_at
                        ? new Date(withdrawal.approved_at).toLocaleDateString("th-TH")
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    ยังไม่มีประวัติการถอนเงิน
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
