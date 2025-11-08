import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useShareholder } from "@/hooks/useShareholder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { Edit, Eye } from "lucide-react";

export default function ShareholderClients() {
  const { shareholder } = useShareholder();
  const queryClient = useQueryClient();
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [newCommissionRate, setNewCommissionRate] = useState("");

  const { data: clients, isLoading } = useQuery({
    queryKey: ["shareholder-clients", shareholder?.id],
    queryFn: async () => {
      if (!shareholder?.id) return [];

      const { data, error } = await supabase
        .from("shareholder_clients")
        .select(`
          *,
          tenants (
            id,
            name,
            status,
            kyc_status,
            created_at
          )
        `)
        .eq("shareholder_id", shareholder.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!shareholder?.id,
  });

  const updateCommissionMutation = useMutation({
    mutationFn: async ({ clientId, rate }: { clientId: string; rate: number }) => {
      const { error } = await supabase
        .from("shareholder_clients")
        .update({ commission_rate: rate })
        .eq("id", clientId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shareholder-clients"] });
      toast.success("อัพเดทเปอร์เซนต์ค่าคอมมิชชั่นสำเร็จ");
      setSelectedClient(null);
      setNewCommissionRate("");
    },
    onError: (error) => {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    },
  });

  const handleUpdateCommission = () => {
    const rate = parseFloat(newCommissionRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error("กรุณาใส่เปอร์เซนต์ระหว่าง 0-100");
      return;
    }

    updateCommissionMutation.mutate({
      clientId: selectedClient.id,
      rate,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            👥 ลูกค้าของฉัน
          </h1>
          <p className="text-muted-foreground mt-2">
            จัดการลูกค้าและค่าคอมมิชชั่น
          </p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          {clients?.length || 0} ลูกค้า
        </Badge>
      </div>

      <Card className="shadow-md hover:shadow-glow transition-all duration-300 border-t-4 border-t-blue-500">
        <CardHeader>
          <CardTitle className="text-xl">📋 รายชื่อลูกค้าทั้งหมด</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อองค์กร</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>KYC</TableHead>
                <TableHead>ค่าคอมมิชชั่น (%)</TableHead>
                <TableHead>วันที่แนะนำ</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients && clients.length > 0 ? (
                clients.map((client: any) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">
                      {client.tenants?.name || "ไม่ระบุ"}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={client.status === "active" ? "default" : "secondary"}
                        className={client.status === "active" ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0" : ""}
                      >
                        {client.status === "active" ? "ใช้งาน" : "ไม่ใช้งาน"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={client.tenants?.kyc_status === "verified" ? "default" : "secondary"}
                        className={client.tenants?.kyc_status === "verified" ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0" : ""}
                      >
                        {client.tenants?.kyc_status || "pending"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center">
                          <span className="text-xs font-bold text-amber-700 dark:text-amber-400">%</span>
                        </div>
                        <span className="font-semibold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                          {client.commission_rate}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(client.referred_at).toLocaleDateString("th-TH")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:border-blue-300 hover:text-blue-700 dark:hover:text-blue-400 transition-all"
                              onClick={() => {
                                setSelectedClient(client);
                                setNewCommissionRate(client.commission_rate.toString());
                              }}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              แก้ไข
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>แก้ไขค่าคอมมิชชั่น</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label>ชื่อองค์กร</Label>
                                <Input
                                  value={client.tenants?.name || ""}
                                  disabled
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>เปอร์เซนต์ค่าคอมมิชชั่น (%)</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  value={newCommissionRate}
                                  onChange={(e) => setNewCommissionRate(e.target.value)}
                                  placeholder="0.00"
                                />
                                <p className="text-xs text-muted-foreground">
                                  ใส่ค่าระหว่าง 0-100
                                </p>
                              </div>
                              <Button
                                onClick={handleUpdateCommission}
                                disabled={updateCommissionMutation.isPending}
                                className="w-full"
                              >
                                {updateCommissionMutation.isPending ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    ยังไม่มีลูกค้า
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
