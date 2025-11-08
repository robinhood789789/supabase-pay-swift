import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useShareholder } from "@/hooks/useShareholder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ShareholderEarnings() {
  const { shareholder } = useShareholder();
  const [selectedTab, setSelectedTab] = useState("all");

  const { data: earnings, isLoading } = useQuery({
    queryKey: ["shareholder-earnings", shareholder?.id, selectedTab],
    queryFn: async () => {
      if (!shareholder?.id) return [];

      let query = supabase
        .from("shareholder_earnings")
        .select(`
          *,
          tenants!inner (
            name,
            user_id,
            profiles:user_id (
              public_id
            )
          )
        `)
        .eq("shareholder_id", shareholder.id)
        .order("created_at", { ascending: false });

      if (selectedTab !== "all") {
        query = query.eq("status", selectedTab);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
    enabled: !!shareholder?.id,
  });

  const { data: summary } = useQuery({
    queryKey: ["shareholder-earnings-summary", shareholder?.id],
    queryFn: async () => {
      if (!shareholder?.id) return null;

      const { data, error } = await supabase
        .from("shareholder_earnings")
        .select("amount, status")
        .eq("shareholder_id", shareholder.id);

      if (error) throw error;

      const pending = data?.filter(e => e.status === "pending").reduce((sum, e) => sum + e.amount, 0) || 0;
      const paid = data?.filter(e => e.status === "paid").reduce((sum, e) => sum + e.amount, 0) || 0;
      const total = data?.reduce((sum, e) => sum + e.amount, 0) || 0;

      return { pending, paid, total };
    },
    enabled: !!shareholder?.id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">รายได้</h1>
        <p className="text-muted-foreground mt-2">
          ติดตามรายได้และประวัติการจ่ายเงิน
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-blue-500 shadow-md hover:shadow-glow transition-all duration-300 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/20 dark:to-background">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">รายได้ทั้งหมด</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(summary?.total || 0)}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500 shadow-md hover:shadow-glow transition-all duration-300 bg-gradient-to-br from-amber-50/50 to-white dark:from-amber-950/20 dark:to-background">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400">รายได้รอจ่าย</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(summary?.pending || 0)}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500 shadow-md hover:shadow-glow transition-all duration-300 bg-gradient-to-br from-green-50/50 to-white dark:from-green-950/20 dark:to-background">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">รายได้ที่จ่ายแล้ว</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(summary?.paid || 0)}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-md hover:shadow-glow transition-all duration-300 border-t-4 border-t-purple-500">
        <CardHeader>
          <CardTitle>ประวัติรายได้</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList>
              <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
              <TabsTrigger value="pending">รอจ่าย</TabsTrigger>
              <TabsTrigger value="paid">จ่ายแล้ว</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedTab} className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    <TableHead>ลูกค้า</TableHead>
                    <TableHead>Public ID</TableHead>
                    <TableHead>ยอดฐาน</TableHead>
                    <TableHead>อัตรา (%)</TableHead>
                    <TableHead>รายได้</TableHead>
                    <TableHead>สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {earnings && earnings.length > 0 ? (
                    earnings.map((earning: any) => (
                      <TableRow key={earning.id}>
                        <TableCell>
                          {new Date(earning.created_at).toLocaleDateString("th-TH")}
                        </TableCell>
                        <TableCell>{earning.tenants?.name || "ไม่ระบุ"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {earning.tenants?.profiles?.public_id || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(earning.base_amount)}</TableCell>
                        <TableCell className="font-semibold text-primary">
                          {earning.commission_rate}%
                        </TableCell>
                        <TableCell className="font-bold">
                          {formatCurrency(earning.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              earning.status === "paid"
                                ? "default"
                                : earning.status === "pending"
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {earning.status === "paid"
                              ? "จ่ายแล้ว"
                              : earning.status === "pending"
                              ? "รอจ่าย"
                              : "ยกเลิก"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        ยังไม่มีรายได้
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
