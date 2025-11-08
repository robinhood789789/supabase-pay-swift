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
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">รายได้</h1>
        <p className="text-sm sm:text-base text-white/80 mt-1 sm:mt-2">
          ติดตามรายได้และประวัติการจ่ายเงิน
        </p>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-l-4 border-l-blue-500 shadow-md hover:shadow-glow transition-all duration-300 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/20 dark:to-background">
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-blue-700 dark:text-blue-400">รายได้ทั้งหมด</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(summary?.total || 0)}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500 shadow-md hover:shadow-glow transition-all duration-300 bg-gradient-to-br from-amber-50/50 to-white dark:from-amber-950/20 dark:to-background">
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-amber-700 dark:text-amber-400">รายได้รอจ่าย</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(summary?.pending || 0)}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500 shadow-md hover:shadow-glow transition-all duration-300 bg-gradient-to-br from-green-50/50 to-white dark:from-green-950/20 dark:to-background">
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-green-700 dark:text-green-400">รายได้ที่จ่ายแล้ว</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(summary?.paid || 0)}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-md hover:shadow-glow transition-all duration-300 border-t-4 border-t-purple-500">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-base sm:text-lg md:text-xl">ประวัติรายได้</CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
              <TabsTrigger value="all" className="text-xs sm:text-sm">ทั้งหมด</TabsTrigger>
              <TabsTrigger value="pending" className="text-xs sm:text-sm">รอจ่าย</TabsTrigger>
              <TabsTrigger value="paid" className="text-xs sm:text-sm">จ่ายแล้ว</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedTab} className="mt-4">
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <Table>
                <TableHeader>
                  <TableRow className="text-xs sm:text-sm">
                    <TableHead className="whitespace-nowrap px-2 sm:px-4">วันที่</TableHead>
                    <TableHead className="whitespace-nowrap px-2 sm:px-4">ลูกค้า</TableHead>
                    <TableHead className="whitespace-nowrap px-2 sm:px-4 hidden md:table-cell">Public ID</TableHead>
                    <TableHead className="whitespace-nowrap px-2 sm:px-4 hidden lg:table-cell">ยอดฐาน</TableHead>
                    <TableHead className="whitespace-nowrap px-2 sm:px-4">อัตรา</TableHead>
                    <TableHead className="whitespace-nowrap px-2 sm:px-4">รายได้</TableHead>
                    <TableHead className="whitespace-nowrap px-2 sm:px-4">สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {earnings && earnings.length > 0 ? (
                    earnings.map((earning: any) => (
                      <TableRow key={earning.id} className="text-xs sm:text-sm">
                        <TableCell className="px-2 sm:px-4 whitespace-nowrap">
                          {new Date(earning.created_at).toLocaleDateString("th-TH", { day: '2-digit', month: 'short' })}
                        </TableCell>
                        <TableCell className="px-2 sm:px-4">
                          <div className="max-w-[100px] sm:max-w-none truncate">
                            {earning.tenants?.name || "ไม่ระบุ"}
                          </div>
                        </TableCell>
                        <TableCell className="px-2 sm:px-4 hidden md:table-cell">
                          <Badge variant="outline" className="font-mono text-[10px] sm:text-xs">
                            {earning.tenants?.profiles?.public_id || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-2 sm:px-4 hidden lg:table-cell text-xs sm:text-sm">
                          {formatCurrency(earning.base_amount)}
                        </TableCell>
                        <TableCell className="px-2 sm:px-4 font-semibold text-primary text-xs sm:text-sm">
                          {earning.commission_rate}%
                        </TableCell>
                        <TableCell className="px-2 sm:px-4 font-bold text-xs sm:text-sm">
                          {formatCurrency(earning.amount)}
                        </TableCell>
                        <TableCell className="px-2 sm:px-4">
                          <Badge
                            variant={
                              earning.status === "paid"
                                ? "default"
                                : earning.status === "pending"
                                ? "secondary"
                                : "destructive"
                            }
                            className="text-[10px] sm:text-xs"
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
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
