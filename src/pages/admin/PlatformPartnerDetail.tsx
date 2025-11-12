import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { invokeFunctionWithTenant } from "@/lib/supabaseFunctions";
import { use2FAChallenge } from "@/hooks/use2FAChallenge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowLeft, TrendingUp, Wallet, Edit, CheckCircle, XCircle, Loader2 } from "lucide-react";

// Mask tenant name for PII
const maskTenantName = (name: string): string => {
  if (!name || name.length < 3) return "***";
  const parts = name.split(' ');
  return parts.map(part => {
    if (part.length <= 2) return part;
    return part[0] + '*'.repeat(part.length - 2) + part[part.length - 1];
  }).join(' ');
};

export default function PlatformPartnerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { checkAndChallenge } = use2FAChallenge();
  
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [newCommissionRate, setNewCommissionRate] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [decisionReason, setDecisionReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["platform-partner-detail", id],
    queryFn: async () => {
      const { data, error } = await invokeFunctionWithTenant("platform-partner-detail", {
        body: { partnerId: id }
      });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const updateCommissionMutation = useMutation({
    mutationFn: async ({ tenantId, rate }: { tenantId: string; rate: number }) => {
      const mfaSuccess = await new Promise<boolean>((resolve) => {
        checkAndChallenge(async () => {
          resolve(true);
        });
      });
      
      if (!mfaSuccess) throw new Error("MFA verification required");

      const { data, error } = await invokeFunctionWithTenant("platform-partner-commission-update", {
        body: {
          partner_id: id,
          tenant_id: tenantId,
          commission_rate: rate,
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-partner-detail", id] });
      toast.success("อัปเดตอัตราคอมมิชชันสำเร็จ");
      setSelectedTenant(null);
      setNewCommissionRate("");
    },
    onError: (error: Error) => {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    },
  });

  const approveRequestMutation = useMutation({
    mutationFn: async ({ requestId, status, reason }: { requestId: string; status: string; reason: string }) => {
      const mfaSuccess = await new Promise<boolean>((resolve) => {
        checkAndChallenge(async () => {
          resolve(true);
        });
      });
      
      if (!mfaSuccess) throw new Error("MFA verification required");

      const { data, error } = await invokeFunctionWithTenant("shareholder-adjust-approve", {
        body: { request_id: requestId, status, reason }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-partner-detail", id] });
      toast.success("ดำเนินการคำขอสำเร็จ");
      setSelectedRequest(null);
      setDecisionReason("");
    },
    onError: (error: Error) => {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 space-y-8 bg-white min-h-screen">
        <Skeleton className="h-12 w-64 bg-gray-200" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 bg-gray-200" />
          ))}
        </div>
      </div>
    );
  }

  const partner = data?.partner;
  const kpis = data?.kpis || {};
  const linkedTenants = data?.linkedTenants || [];
  const adjustRequests = data?.adjustRequests || [];
  const commissionEvents = data?.commissionEvents || [];
  const payouts = data?.payouts || [];

  return (
    <div className="container mx-auto py-8 space-y-8 bg-white min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/platform/partners")} className="hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-black" />
          </Button>
          <div>
            <h1 className="text-2xl font-medium text-black tracking-tight">{partner?.full_name}</h1>
            <p className="text-gray-600">{partner?.email}</p>
          </div>
        </div>
        <Badge variant={partner?.status === "active" ? "default" : "secondary"} className={partner?.status === "active" ? "bg-black text-white" : "bg-gray-200 text-gray-700"}>
          {partner?.status === "active" ? "ใช้งาน" : "ไม่ใช้งาน"}
        </Badge>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border border-gray-200 bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">รายได้เดือนนี้</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-black">{formatCurrency(kpis.monthly_commission || 0)}</div>
            <p className="text-xs text-gray-600 mt-1">
              ฐาน: {formatCurrency(kpis.monthly_base || 0)}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">รายได้ปีนี้</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-black">{formatCurrency(kpis.yearly_commission || 0)}</div>
            <p className="text-xs text-gray-600 mt-1">
              ฐาน: {formatCurrency(kpis.yearly_base || 0)}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">ยอดคงเหลือ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-black">{formatCurrency(kpis.balance || 0)}</div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">การตั้งค่า</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm text-gray-700">
              <div>ประเภท: <Badge variant="outline" className="border-gray-300 text-gray-700">{partner?.default_commission_type}</Badge></div>
              <div>% เริ่มต้น: <span className="font-semibold text-black">{partner?.default_commission_value}%</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tenants" className="space-y-4">
        <TabsList className="bg-gray-50 border border-gray-200">
          <TabsTrigger value="tenants" className="data-[state=active]:bg-white data-[state=active]:text-black">Tenants ที่ผูก ({linkedTenants.length})</TabsTrigger>
          <TabsTrigger value="requests" className="data-[state=active]:bg-white data-[state=active]:text-black">คำขอปรับ % ({adjustRequests.length})</TabsTrigger>
          <TabsTrigger value="events" className="data-[state=active]:bg-white data-[state=active]:text-black">Commission Events</TabsTrigger>
          <TabsTrigger value="payouts" className="data-[state=active]:bg-white data-[state=active]:text-black">Payouts ({payouts.length})</TabsTrigger>
        </TabsList>

        {/* Linked Tenants */}
        <TabsContent value="tenants">
          <Card className="border border-gray-200 bg-white">
            <CardHeader>
              <CardTitle className="text-black font-medium tracking-tight">Tenants ที่ผูก</CardTitle>
              <CardDescription className="text-gray-600">รายชื่อ Owner ที่พาร์ทเนอร์แนะนำมา</CardDescription>
            </CardHeader>
            <CardContent>
              {linkedTenants.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>องค์กร (Masked)</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead>ประเภท</TableHead>
                      <TableHead>% ปัจจุบัน</TableHead>
                      <TableHead>Bounty</TableHead>
                      <TableHead>วันที่เชื่อมโยง</TableHead>
                      <TableHead>การดำเนินการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linkedTenants.map((link: any) => (
                      <TableRow key={link.id}>
                           <TableCell className="text-gray-700">{maskTenantName(link.tenants?.name || "N/A")}</TableCell>
                        <TableCell>
                          <Badge variant={link.status === "active" ? "default" : "secondary"} className={link.status === "active" ? "bg-black text-white" : "bg-gray-200 text-gray-700"}>
                            {link.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-gray-300 text-gray-700">{link.commission_type}</Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-black">{link.commission_rate}%</TableCell>
                        <TableCell className="text-gray-700">{link.bounty_amount > 0 ? formatCurrency(link.bounty_amount) : "-"}</TableCell>
                        <TableCell className="text-gray-700">{new Date(link.referred_at).toLocaleDateString("th-TH")}</TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedTenant(link);
                                  setNewCommissionRate(link.commission_rate.toString());
                                }}
                                className="hover:bg-gray-100 text-gray-700"
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                ปรับ %
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>ปรับอัตราคอมมิชชัน</DialogTitle>
                                <DialogDescription>
                                  ต้องการ MFA ก่อนบันทึก
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div>
                                  <Label>อัตราใหม่ (%)</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={newCommissionRate}
                                    onChange={(e) => setNewCommissionRate(e.target.value)}
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button
                                  onClick={() => {
                                    const rate = parseFloat(newCommissionRate);
                                    if (isNaN(rate) || rate < 0 || rate > 100) {
                                      toast.error("กรุณาใส่เปอร์เซนต์ 0-100");
                                      return;
                                    }
                                    updateCommissionMutation.mutate({ tenantId: link.tenant_id, rate });
                                  }}
                                  disabled={updateCommissionMutation.isPending}
                                  className="bg-black text-white hover:bg-gray-800 border-0"
                                >
                                  {updateCommissionMutation.isPending && (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  )}
                                  บันทึก (MFA Required)
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-600">ยังไม่มี Tenant</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Adjust Requests */}
        <TabsContent value="requests">
          <Card className="border border-gray-200 bg-white">
            <CardHeader>
              <CardTitle className="text-black font-medium tracking-tight">คำขอปรับเปอร์เซ็นต์</CardTitle>
              <CardDescription className="text-gray-600">คำขอที่รออนุมัติจากพาร์ทเนอร์</CardDescription>
            </CardHeader>
            <CardContent>
              {adjustRequests.length > 0 ? (
                <div className="space-y-4">
                  {adjustRequests.map((req: any) => (
                    <Card key={req.id} className="border border-gray-200 bg-white">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="font-medium text-black">
                              Tenant: {maskTenantName(req.tenants?.name || "N/A")}
                            </div>
                            <div className="text-sm text-gray-600">
                              เปลี่ยนจาก <span className="font-semibold text-black">{req.current_percent}%</span> เป็น{" "}
                              <span className="font-semibold text-black">{req.requested_percent}%</span>
                            </div>
                            <div className="text-xs text-gray-600">
                              ขอเมื่อ: {new Date(req.requested_at).toLocaleString("th-TH")}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => setSelectedRequest(req)}
                                  className="bg-black text-white hover:bg-gray-800 border-0"
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  อนุมัติ
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>อนุมัติคำขอ</DialogTitle>
                                  <DialogDescription>ต้องการ MFA ก่อนยืนยัน</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div>
                                    <Label>เหตุผล (ถ้ามี)</Label>
                                    <Textarea
                                      value={decisionReason}
                                      onChange={(e) => setDecisionReason(e.target.value)}
                                      placeholder="ระบุเหตุผลในการอนุมัติ..."
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button
                                    onClick={() => {
                                      approveRequestMutation.mutate({
                                        requestId: req.id,
                                        status: "approved",
                                        reason: decisionReason
                                      });
                                    }}
                                    disabled={approveRequestMutation.isPending}
                                    className="bg-black text-white hover:bg-gray-800 border-0"
                                  >
                                    {approveRequestMutation.isPending && (
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    )}
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
                  onClick={() => setSelectedRequest(req)}
                  className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  ปฏิเสธ
                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>ปฏิเสธคำขอ</DialogTitle>
                                  <DialogDescription>ต้องการ MFA และเหตุผล</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div>
                                    <Label>เหตุผล (บังคับ)</Label>
                                    <Textarea
                                      value={decisionReason}
                                      onChange={(e) => setDecisionReason(e.target.value)}
                                      placeholder="ระบุเหตุผลในการปฏิเสธ..."
                                      required
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button
                                    variant="destructive"
                                    onClick={() => {
                                      if (!decisionReason.trim()) {
                                        toast.error("กรุณาระบุเหตุผล");
                                        return;
                                      }
                                      approveRequestMutation.mutate({
                                        requestId: req.id,
                                        status: "rejected",
                                        reason: decisionReason
                                      });
                                    }}
                                    disabled={approveRequestMutation.isPending}
                                    className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                                  >
                                    {approveRequestMutation.isPending && (
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    )}
                                    ปฏิเสธ
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-600">ไม่มีคำขอรออนุมัติ</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Commission Events */}
        <TabsContent value="events">
          <Card className="border border-gray-200 bg-white">
            <CardHeader>
              <CardTitle className="text-black font-medium tracking-tight">Commission Events</CardTitle>
              <CardDescription className="text-gray-600">ประวัติรายการคอมมิชชัน (100 รายการล่าสุด)</CardDescription>
            </CardHeader>
            <CardContent>
              {commissionEvents.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>วันที่</TableHead>
                      <TableHead>ประเภท</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>ฐาน</TableHead>
                      <TableHead>%</TableHead>
                      <TableHead>คอมมิชชัน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissionEvents.map((event: any) => (
                      <TableRow key={event.id}>
                        <TableCell className="text-xs text-gray-700">
                          {new Date(event.occurred_at).toLocaleString("th-TH")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-gray-300 text-gray-700">{event.event_type}</Badge>
                        </TableCell>
                        <TableCell className="text-gray-700">{maskTenantName(event.tenants?.name || "N/A")}</TableCell>
                        <TableCell className="text-gray-700">{formatCurrency(event.base_value)}</TableCell>
                        <TableCell className="text-gray-700">{event.commission_percent}%</TableCell>
                        <TableCell className="font-semibold text-black">
                          {formatCurrency(event.commission_amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-600">ยังไม่มีรายการ</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payouts */}
        <TabsContent value="payouts">
          <Card className="border border-gray-200 bg-white">
            <CardHeader>
              <CardTitle className="text-black font-medium tracking-tight">Payouts</CardTitle>
              <CardDescription className="text-gray-600">ประวัติการขอถอนเงิน (50 รายการล่าสุด)</CardDescription>
            </CardHeader>
            <CardContent>
              {payouts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>วันที่ขอ</TableHead>
                      <TableHead>จำนวน</TableHead>
                      <TableHead>ธนาคาร</TableHead>
                      <TableHead>เลขบัญชี</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead>วันที่จ่าย</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payouts.map((payout: any) => (
                      <TableRow key={payout.id}>
                        <TableCell className="text-xs text-gray-700">
                          {new Date(payout.requested_at).toLocaleString("th-TH")}
                        </TableCell>
                        <TableCell className="font-semibold text-black">{formatCurrency(payout.amount)}</TableCell>
                        <TableCell className="text-gray-700">{payout.bank_name}</TableCell>
                        <TableCell className="font-mono text-gray-700">{payout.bank_account_number}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              payout.status === "completed" ? "default" :
                              payout.status === "pending" ? "secondary" :
                              "destructive"
                            }
                            className={
                              payout.status === "completed" ? "bg-black text-white" :
                              payout.status === "pending" ? "bg-gray-200 text-gray-700" :
                              "bg-gray-100 text-gray-700 border border-gray-300"
                            }
                          >
                            {payout.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-gray-700">
                          {payout.paid_at ? new Date(payout.paid_at).toLocaleString("th-TH") : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-600">ยังไม่มีประวัติ Payout</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
