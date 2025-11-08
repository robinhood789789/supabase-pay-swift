import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunctionWithTenant } from "@/lib/supabaseFunctions";
import { use2FAChallenge } from "@/hooks/use2FAChallenge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { CheckCircle, XCircle, RefreshCw, DollarSign, Loader2, Filter } from "lucide-react";

export default function PlatformPartnerPayouts() {
  const queryClient = useQueryClient();
  const { checkAndChallenge } = use2FAChallenge();
  
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPayout, setSelectedPayout] = useState<any>(null);
  const [action, setAction] = useState<string>("");
  const [reason, setReason] = useState("");
  const [bankReference, setBankReference] = useState("");

  const { data: payouts, isLoading } = useQuery({
    queryKey: ["platform-partner-payouts", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("shareholder_withdrawals")
        .select(`
          *,
          shareholders (
            full_name,
            email
          )
        `)
        .order("requested_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const managePayout = useMutation({
    mutationFn: async ({ payoutId, action, reason, bankRef }: any) => {
      const mfaSuccess = await new Promise<boolean>((resolve) => {
        checkAndChallenge(async () => {
          resolve(true);
        });
      });
      
      if (!mfaSuccess) throw new Error("MFA verification required");

      const { data, error } = await invokeFunctionWithTenant("platform-partner-payout-manage", {
        body: {
          payout_id: payoutId,
          action: action,
          reason: reason,
          bank_reference: bankRef
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-partner-payouts"] });
      toast.success("ดำเนินการสำเร็จ");
      setSelectedPayout(null);
      setAction("");
      setReason("");
      setBankReference("");
    },
    onError: (error: Error) => {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: { variant: "secondary", label: "รอดำเนินการ" },
      approved: { variant: "default", label: "อนุมัติแล้ว" },
      rejected: { variant: "destructive", label: "ปฏิเสธ" },
      completed: { variant: "default", label: "จ่ายแล้ว" },
      failed: { variant: "destructive", label: "ล้มเหลว" },
    };
    const config = variants[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">จัดการ Payouts พาร์ทเนอร์</h1>
        <p className="text-muted-foreground mt-2">
          อนุมัติและจัดการการถอนเงินของพาร์ทเนอร์ (Dual Control + MFA)
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>รายการ Payouts</CardTitle>
              <CardDescription>คำขอถอนเงินทั้งหมด</CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">สถานะทั้งหมด</SelectItem>
                <SelectItem value="pending">รอดำเนินการ</SelectItem>
                <SelectItem value="approved">อนุมัติแล้ว</SelectItem>
                <SelectItem value="completed">จ่ายแล้ว</SelectItem>
                <SelectItem value="rejected">ปฏิเสธ</SelectItem>
                <SelectItem value="failed">ล้มเหลว</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : payouts && payouts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่ขอ</TableHead>
                  <TableHead>พาร์ทเนอร์</TableHead>
                  <TableHead>จำนวน</TableHead>
                  <TableHead>ธนาคาร</TableHead>
                  <TableHead>เลขบัญชี</TableHead>
                  <TableHead>ชื่อบัญชี</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>วันที่จ่าย</TableHead>
                  <TableHead>การดำเนินการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout: any) => (
                  <TableRow key={payout.id}>
                    <TableCell className="text-xs">
                      {new Date(payout.requested_at).toLocaleString("th-TH")}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{payout.shareholders?.full_name}</div>
                        <div className="text-xs text-muted-foreground">{payout.shareholders?.email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-bold text-lg">{formatCurrency(payout.amount)}</TableCell>
                    <TableCell>{payout.bank_name}</TableCell>
                    <TableCell className="font-mono text-xs">{payout.bank_account_number}</TableCell>
                    <TableCell>{payout.bank_account_name}</TableCell>
                    <TableCell>{getStatusBadge(payout.status)}</TableCell>
                    <TableCell className="text-xs">
                      {payout.paid_at ? new Date(payout.paid_at).toLocaleString("th-TH") : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {payout.status === "pending" && (
                          <>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => {
                                    setSelectedPayout(payout);
                                    setAction("approve");
                                  }}
                                >
                                  <CheckCircle className="h-3 w-3" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>อนุมัติ Payout</DialogTitle>
                                  <DialogDescription>
                                    จำนวน: {formatCurrency(payout.amount)}<br />
                                    ต้องการ MFA (Dual Control)
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div>
                                    <Label>เหตุผล (ถ้ามี)</Label>
                                    <Textarea
                                      value={reason}
                                      onChange={(e) => setReason(e.target.value)}
                                      placeholder="ระบุเหตุผล..."
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button
                                    onClick={() => {
                                      managePayout.mutate({
                                        payoutId: payout.id,
                                        action: "approve",
                                        reason: reason,
                                        bankRef: null
                                      });
                                    }}
                                    disabled={managePayout.isPending}
                                  >
                                    {managePayout.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    อนุมัติ
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>

                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setSelectedPayout(payout);
                                    setAction("reject");
                                  }}
                                >
                                  <XCircle className="h-3 w-3" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>ปฏิเสธ Payout</DialogTitle>
                                  <DialogDescription>ต้องการเหตุผล + MFA</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div>
                                    <Label>เหตุผล (บังคับ)</Label>
                                    <Textarea
                                      value={reason}
                                      onChange={(e) => setReason(e.target.value)}
                                      placeholder="ระบุเหตุผลในการปฏิเสธ..."
                                      required
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button
                                    variant="destructive"
                                    onClick={() => {
                                      if (!reason.trim()) {
                                        toast.error("กรุณาระบุเหตุผล");
                                        return;
                                      }
                                      managePayout.mutate({
                                        payoutId: payout.id,
                                        action: "reject",
                                        reason: reason,
                                        bankRef: null
                                      });
                                    }}
                                    disabled={managePayout.isPending}
                                  >
                                    {managePayout.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    ปฏิเสธ
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </>
                        )}

                        {["pending", "approved"].includes(payout.status) && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedPayout(payout);
                                  setAction("mark_paid");
                                }}
                              >
                                <DollarSign className="h-3 w-3" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>ทำเครื่องหมายว่าจ่ายแล้ว</DialogTitle>
                                <DialogDescription>ต้องการ MFA</DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div>
                                  <Label>เลขอ้างอิงธนาคาร</Label>
                                  <Input
                                    value={bankReference}
                                    onChange={(e) => setBankReference(e.target.value)}
                                    placeholder="ระบุเลขอ้างอิง..."
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button
                                  onClick={() => {
                                    managePayout.mutate({
                                      payoutId: payout.id,
                                      action: "mark_paid",
                                      reason: null,
                                      bankRef: bankReference
                                    });
                                  }}
                                  disabled={managePayout.isPending}
                                >
                                  {managePayout.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                  ยืนยันจ่ายแล้ว
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}

                        {!["completed", "rejected"].includes(payout.status) && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedPayout(payout);
                                  setAction("mark_failed");
                                }}
                              >
                                <RefreshCw className="h-3 w-3" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>ทำเครื่องหมายว่าล้มเหลว</DialogTitle>
                                <DialogDescription>ต้องการเหตุผล + MFA (จะคืนเงินให้พาร์ทเนอร์)</DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div>
                                  <Label>เหตุผล (บังคับ)</Label>
                                  <Textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="ระบุเหตุผลที่ล้มเหลว..."
                                    required
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button
                                  variant="destructive"
                                  onClick={() => {
                                    if (!reason.trim()) {
                                      toast.error("กรุณาระบุเหตุผล");
                                      return;
                                    }
                                    managePayout.mutate({
                                      payoutId: payout.id,
                                      action: "mark_failed",
                                      reason: reason,
                                      bankRef: null
                                    });
                                  }}
                                  disabled={managePayout.isPending}
                                >
                                  {managePayout.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                  ทำเครื่องหมายล้มเหลว
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              ไม่มีรายการ Payout
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
