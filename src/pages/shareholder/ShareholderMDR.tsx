import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useShareholder } from "@/hooks/useShareholder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { formatCurrency } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, TrendingUp, DollarSign, Percent, TestTube, Edit } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { mockShareholderMDRData, mockSummary } from "@/data/mockShareholderMDR";
import { EditCommissionDialog } from "@/components/shareholder/EditCommissionDialog";

interface ClientMDRData {
  tenant_id: string;
  tenant_public_id: string;
  period_start: string;
  period_end: string;
  total_deposit: number;
  total_topup: number;
  total_payout: number;
  total_settlement: number;
  total_transfer_amount: number; // ยอดการโอนรวม
  shareholder_commission_rate: number;
  owner_commission_rate: number;
  shareholder_commission_amount: number;
  owner_commission_amount: number;
}

export default function ShareholderMDR() {
  const { shareholder } = useShareholder();
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().setDate(1)));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [useMockData, setUseMockData] = useState(false);
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<{
    tenantId: string;
    tenantName: string;
    currentRate: number;
  } | null>(null);

  // Fetch client MDR data with commission calculation
  const { data: clientMDRData, isLoading } = useQuery<ClientMDRData[]>({
    queryKey: ["shareholder-mdr", shareholder?.id, format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd"), useMockData],
    queryFn: async () => {
      // Use mock data if enabled
      if (useMockData) {
        return mockShareholderMDRData as ClientMDRData[];
      }
      
      if (!shareholder?.id) return [];

      const startDateStr = format(startDate, "yyyy-MM-dd");
      const endDateStr = format(endDate, "yyyy-MM-dd");

      // Get shareholder's clients
      const { data: clients, error: clientsError } = await supabase
        .from("shareholder_clients")
        .select(`
          tenant_id,
          commission_rate,
          tenants!inner (
            name,
            public_id
          )
        `)
        .eq("shareholder_id", shareholder.id)
        .eq("status", "active");

      if (clientsError) {
        console.error("Error fetching clients:", clientsError);
        throw clientsError;
      }

      console.log("Fetched clients:", clients);

      // For each client, fetch MDR data
      const mdrPromises = clients?.map(async (client) => {
        // Fetch deposit_transfers for this tenant
        const { data: deposits } = await supabase
          .from("deposit_transfers")
          .select("amountpaid")
          .eq("tenant_id", client.tenant_id)
          .gte("depositdate", startDateStr)
          .lte("depositdate", endDateStr);

        // Fetch topup_transfers for this tenant (match by merchant_code = tenant public_id)
        const { data: topups } = await supabase
          .from("topup_transfers")
          .select("amount")
          .eq("merchant_code", (client.tenants as any).public_id)
          .gte("transfer_date", startDateStr)
          .lte("transfer_date", endDateStr);

        // Fetch settlement_transfers for this tenant
        const { data: settlements } = await supabase
          .from("settlement_transfers")
          .select("amount")
          .eq("merchant_code", (client.tenants as any).public_id)
          .gte("created_at", startDateStr)
          .lte("created_at", endDateStr);

        const totalDeposit = deposits?.reduce((sum, d) => sum + (Number(d.amountpaid) || 0), 0) || 0;
        const totalTopup = topups?.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;
        const totalSettlement = settlements?.reduce((sum, s) => sum + (Number(s.amount) || 0), 0) || 0;
        const totalPayout = 0; // You can add payout logic if needed

        // Calculate commissions directly from transfer amount
        const shareholderRate = client.commission_rate / 100; // Convert percentage to decimal
        const ownerRate = 0.005; // 0.5% for owner (example - should come from database)
        
        // Total transfer amount (ยอดการโอนรวม)
        const totalTransferAmount = totalDeposit + totalTopup + totalPayout + totalSettlement;
        
        // Shareholder gets their % of total transfer amount
        const shareholderCommission = totalTransferAmount * shareholderRate;
        
        // Owner gets their % of total transfer amount
        const ownerCommission = totalTransferAmount * ownerRate;

        return {
          tenant_id: client.tenant_id,
          tenant_public_id: (client.tenants as any).public_id,
          period_start: startDateStr,
          period_end: endDateStr,
          total_deposit: totalDeposit,
          total_topup: totalTopup,
          total_payout: totalPayout,
          total_settlement: totalSettlement,
          total_transfer_amount: totalTransferAmount,
          shareholder_commission_rate: shareholderRate * 100,
          owner_commission_rate: ownerRate * 100,
          shareholder_commission_amount: shareholderCommission,
          owner_commission_amount: ownerCommission,
        };
      }) || [];

      return Promise.all(mdrPromises);
    },
    enabled: useMockData || !!shareholder?.id, // Enable if using mock data or if shareholder exists
  });

  // Calculate summary totals
  const summary = useMockData 
    ? mockSummary 
    : clientMDRData?.reduce(
        (acc, curr) => ({
          totalTransferAmount: acc.totalTransferAmount + curr.total_transfer_amount,
          shareholderCommission: acc.shareholderCommission + curr.shareholder_commission_amount,
          ownerCommission: acc.ownerCommission + curr.owner_commission_amount,
        }),
        { totalTransferAmount: 0, shareholderCommission: 0, ownerCommission: 0 }
      );

  // Pagination calculations
  const totalCount = clientMDRData?.length || 0;
  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = clientMDRData?.slice(startIndex, endIndex) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">MDR และค่าคอมมิชชั่น</h1>
          <p className="text-muted-foreground mt-2">
            ดูรายละเอียดการคำนวณ MDR และสัดส่วนค่าคอมมิชชั่นแบบลดหลั่น
          </p>
        </div>
        <Button
          variant={useMockData ? "default" : "outline"}
          size="sm"
          onClick={() => setUseMockData(!useMockData)}
          className="gap-2"
        >
          <TestTube className="h-4 w-4" />
          {useMockData ? "ข้อมูลจำลอง" : "ข้อมูลจริง"}
        </Button>
      </div>

      {/* Date Range Filters */}
      <Card className="border border-border shadow-soft bg-card">
        <CardHeader>
          <CardTitle className="text-lg">เลือกช่วงเวลา</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">วันที่เริ่มต้น</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[240px] justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : <span>เลือกวันที่</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">วันที่สิ้นสุด</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[240px] justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : <span>เลือกวันที่</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <Card className="border border-border shadow-soft bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              ยอดการโอนรวมทั้งหมด
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-foreground">{formatCurrency(summary?.totalTransferAmount || 0)}</div>
          </CardContent>
        </Card>

        <Card className="border border-emerald-200 shadow-soft bg-emerald-50 dark:bg-emerald-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              ส่วนแบ่ง Shareholder
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {formatCurrency(summary?.shareholderCommission || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* MDR Table */}
      <Card className="border border-border shadow-soft bg-card">
        <CardHeader>
          <CardTitle>รายละเอียดการคำนวณแต่ละลูกค้า</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="border-r bg-white dark:bg-slate-950 font-semibold">Public ID</TableHead>
                    <TableHead className="text-right border-r bg-emerald-100 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-400 font-semibold">ยอดรวม</TableHead>
                    <TableHead className="text-right border-r bg-emerald-100 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-400 font-semibold">
                      ส่วนแบ่ง Shareholder
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!paginatedData || paginatedData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        ไม่พบข้อมูลในช่วงเวลานี้
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedData.map((row, index) => (
                      <TableRow key={index} className="hover:bg-blue-50/30 dark:hover:bg-slate-900/50">
                        <TableCell 
                          className="border-r bg-white dark:bg-slate-950 font-medium text-primary cursor-pointer hover:underline"
                          onClick={() => navigate("/deposit-list", { 
                            state: { 
                              tenantId: row.tenant_id,
                              tenantPublicId: row.tenant_public_id
                            } 
                          })}
                        >
                          {row.tenant_public_id}
                        </TableCell>
                        <TableCell className="text-right bg-emerald-50/50 dark:bg-emerald-950/10 border-r text-emerald-700 dark:text-emerald-400 font-bold">
                          {formatCurrency(row.total_transfer_amount)}
                        </TableCell>
                        <TableCell className="text-right bg-emerald-50/50 dark:bg-emerald-950/10 text-emerald-700 dark:text-emerald-400 font-bold">
                          {formatCurrency(row.shareholder_commission_amount)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      {totalCount > 0 && (
        <Card className="border border-border shadow-soft bg-card">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Items per page selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">แสดง</span>
                <Select value={itemsPerPage.toString()} onValueChange={(value) => {
                  setItemsPerPage(Number(value));
                  setPage(1);
                }}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">รายการ</span>
              </div>

              {/* Page info */}
              <div className="text-sm text-muted-foreground">
                หน้า {page} จาก {totalPages} ({totalCount} รายการทั้งหมด)
              </div>

              {/* Pagination */}
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }

                    return (
                      <PaginationItem key={i}>
                        <PaginationLink
                          onClick={() => setPage(pageNum)}
                          isActive={page === pageNum}
                          className="cursor-pointer"
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}

                  {totalPages > 5 && page < totalPages - 2 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}

                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Commission Dialog */}
      {selectedClient && shareholder && (
        <EditCommissionDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          tenantId={selectedClient.tenantId}
          tenantName={selectedClient.tenantName}
          currentRate={selectedClient.currentRate}
          shareholderId={shareholder.id}
        />
      )}
    </div>
  );
}
