import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DailyMDRData {
  date: string;
  merchant: string;
  totalDeposit: number;
  mdrDeposit: number;
  totalTopup: number;
  mdrTopup: number;
  totalPayout: number;
  mdrPayout: number;
  totalSettlement: number;
  mdrSettlement: number;
  totalMDR: number;
}

const MDR = () => {
  const { activeTenantId } = useTenantSwitcher();
  const [startDate, setStartDate] = useState<Date>(new Date("2025-07-01"));
  const [endDate, setEndDate] = useState<Date>(new Date("2025-08-05"));
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Fetch and calculate MDR data from all sources
  const { data: mdrData, isLoading, error: queryError, refetch } = useQuery<{
    dailyData: DailyMDRData[];
    paginatedData: DailyMDRData[];
    totalPages: number;
    summary: {
      depositAmount: number;
      topupAmount: number;
      payoutAmount: number;
      settlementAmount: number;
      mdrDeposit: number;
      mdrTopup: number;
      mdrPayout: number;
      mdrSettlement: number;
    };
  }>({
    queryKey: ["mdr-report", format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd"), page, itemsPerPage],
    queryFn: async () => {
      // Use Bangkok timezone (UTC+7) for date queries
      const timezone = "Asia/Bangkok";
      const startDateStr = formatInTimeZone(startDate, timezone, "yyyy-MM-dd");
      const endDateStr = formatInTimeZone(endDate, timezone, "yyyy-MM-dd");
      
      console.log("Fetching MDR data with filters:", { startDateStr, endDateStr, timezone });
      
      // 1. Query deposit_transfers data (เติมเงิน)
      let depositQuery = (supabase as any)
        .from("deposit_transfers")
        .select("*")
        .gte("depositdate", startDateStr)
        .lte("depositdate", endDateStr);
      
      if (activeTenantId) {
        depositQuery = depositQuery.eq("tenant_id", activeTenantId);
      }
      
      depositQuery = depositQuery.order("depositdate", { ascending: true });

      const { data: depositData, error: depositError } = await depositQuery;
      
      if (depositError) {
        console.error("Error fetching deposit_transfers:", depositError);
        throw depositError;
      }

      // 2. Query topup_transfers data (เติมเงินเข้าระบบ owner)
      let topupQuery = (supabase as any)
        .from("topup_transfers")
        .select("*")
        .gte("transfer_date", startDateStr)
        .lte("transfer_date", endDateStr);
      
      if (activeTenantId) {
        topupQuery = topupQuery.eq("tenant_id", activeTenantId);
      }
      
      topupQuery = topupQuery.order("transfer_date", { ascending: true });

      const { data: topupData, error: topupError } = await topupQuery;
      
      if (topupError) {
        console.error("Error fetching topup_transfers:", topupError);
        throw topupError;
      }

      // 3. Query settlement_transfers data (ถอนเงิน และ ถอนเงินระบบ owner)
      let settlementQuery = (supabase as any)
        .from("settlement_transfers")
        .select("*")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr);
      
      if (activeTenantId) {
        settlementQuery = settlementQuery.eq("tenant_id", activeTenantId);
      }
      
      settlementQuery = settlementQuery.order("created_at", { ascending: true });

      const { data: settlementData, error: settlementError } = await settlementQuery;
      
      if (settlementError) {
        console.error("Error fetching settlement_transfers:", settlementError);
        throw settlementError;
      }

      console.log("Query results:", { 
        depositCount: depositData?.length || 0, 
        topupCount: topupData?.length || 0,
        settlementCount: settlementData?.length || 0
      });

      // Group data by date and merchant
      const dailyMap = new Map<string, DailyMDRData>();
      
      // Process deposit_transfers (เติมเงิน)
      (depositData || []).forEach((item: any) => {
        const date = item.depositdate ? format(new Date(item.depositdate), "yyyy-MM-dd") : format(new Date(item.created_at), "yyyy-MM-dd");
        const amount = parseFloat(item.amountpaid || 0);
        
        if (!dailyMap.has(date)) {
          dailyMap.set(date, {
            date,
            merchant: "all",
            totalDeposit: 0,
            mdrDeposit: 0,
            totalTopup: 0,
            mdrTopup: 0,
            totalPayout: 0,
            mdrPayout: 0,
            totalSettlement: 0,
            mdrSettlement: 0,
            totalMDR: 0,
          });
        }

        const dayData = dailyMap.get(date)!;
        
        // Calculate based on status (3 = completed)
        if (item.status === "3" && amount > 0) {
          dayData.totalDeposit += amount;
          // Calculate MDR (1.5% for deposits)
          dayData.mdrDeposit += amount * 0.015;
        }
      });

      // Process topup_transfers (เติมเงินเข้าระบบ owner)
      (topupData || []).forEach((item: any) => {
        const date = item.transfer_date ? format(new Date(item.transfer_date), "yyyy-MM-dd") : format(new Date(item.created_at), "yyyy-MM-dd");
        const amount = parseFloat(item.amount || 0);
        
        if (!dailyMap.has(date)) {
          dailyMap.set(date, {
            date,
            merchant: "all",
            totalDeposit: 0,
            mdrDeposit: 0,
            totalTopup: 0,
            mdrTopup: 0,
            totalPayout: 0,
            mdrPayout: 0,
            totalSettlement: 0,
            mdrSettlement: 0,
            totalMDR: 0,
          });
        }

        const dayData = dailyMap.get(date)!;
        
        // Calculate based on status (completed)
        if (item.status === "completed" && amount > 0) {
          dayData.totalTopup += amount;
          // Calculate MDR (1.5% for topups)
          dayData.mdrTopup += amount * 0.015;
        }
      });

      // Process settlement_transfers (ถอนเงิน)
      (settlementData || []).forEach((item: any) => {
        const date = format(new Date(item.created_at), "yyyy-MM-dd");
        const amount = parseFloat(item.amount || 0);
        
        if (!dailyMap.has(date)) {
          dailyMap.set(date, {
            date,
            merchant: "all",
            totalDeposit: 0,
            mdrDeposit: 0,
            totalTopup: 0,
            mdrTopup: 0,
            totalPayout: 0,
            mdrPayout: 0,
            totalSettlement: 0,
            mdrSettlement: 0,
            totalMDR: 0,
          });
        }

        const dayData = dailyMap.get(date)!;
        
        // Calculate based on status (completed/approved)
        if ((item.status === "completed" || item.status === "approved") && amount > 0) {
          dayData.totalPayout += amount;
          // Calculate MDR (1.5% for payouts)
          dayData.mdrPayout += amount * 0.015;
          
          dayData.totalSettlement += amount;
          // Calculate MDR for settlements (1.5%)
          dayData.mdrSettlement += amount * 0.015;
        }
      });

      // Calculate total MDR for each day
      dailyMap.forEach((dayData) => {
        dayData.totalMDR = dayData.mdrDeposit + dayData.mdrTopup + dayData.mdrPayout + dayData.mdrSettlement;
      });

      const dailyData = Array.from(dailyMap.values());

      // Calculate pagination
      const totalPages = Math.ceil(dailyData.length / itemsPerPage);
      const startIndex = (page - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const paginatedData = dailyData.slice(startIndex, endIndex);

      // Calculate summary
      const summary = dailyData.reduce(
        (acc, day) => ({
          depositAmount: acc.depositAmount + day.totalDeposit,
          topupAmount: acc.topupAmount + day.totalTopup,
          payoutAmount: acc.payoutAmount + day.totalPayout,
          settlementAmount: acc.settlementAmount + day.totalSettlement,
          mdrDeposit: acc.mdrDeposit + day.mdrDeposit,
          mdrTopup: acc.mdrTopup + day.mdrTopup,
          mdrPayout: acc.mdrPayout + day.mdrPayout,
          mdrSettlement: acc.mdrSettlement + day.mdrSettlement,
        }),
        {
          depositAmount: 0,
          topupAmount: 0,
          payoutAmount: 0,
          settlementAmount: 0,
          mdrDeposit: 0,
          mdrTopup: 0,
          mdrPayout: 0,
          mdrSettlement: 0,
        }
      );

      return { dailyData, paginatedData, totalPages, summary };
    },
    enabled: true,
  });

  const formatNumber = (num: number) => {
    return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleSubmit = () => {
    setPage(1); // Reset to page 1 when filters change
    refetch();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">MDR Report</h1>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[180px] justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "dd/MM/yyyy") : <span>เลือกวันที่</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => date && setStartDate(date)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <span className="text-muted-foreground pb-2">—</span>
              
              <div className="space-y-2">
                <Label className="invisible">End</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[180px] justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "dd/MM/yyyy") : <span>เลือกวันที่</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => date && setEndDate(date)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <Button onClick={handleSubmit} disabled={isLoading}>
                Submit
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-medium text-muted-foreground">Deposit Amount</h3>
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatNumber(mdrData?.summary.depositAmount || 0)}
                </p>
                <p className="text-sm text-muted-foreground">
                  [ MDR {formatNumber(mdrData?.summary.mdrDeposit || 0)} ]
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-medium text-muted-foreground">Topup Amount</h3>
                <p className="text-3xl font-bold text-cyan-700 dark:text-cyan-400">
                  {formatNumber(mdrData?.summary.topupAmount || 0)}
                </p>
                <p className="text-sm text-muted-foreground">
                  [ MDR {formatNumber(mdrData?.summary.mdrTopup || 0)} ]
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-medium text-muted-foreground">Payout Amount</h3>
                <p className="text-3xl font-bold text-rose-600 dark:text-rose-400">
                  {formatNumber(mdrData?.summary.payoutAmount || 0)}
                </p>
                <p className="text-sm text-muted-foreground">
                  [ MDR {formatNumber(mdrData?.summary.mdrPayout || 0)} ]
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-medium text-muted-foreground">Settlement Amount</h3>
                <p className="text-3xl font-bold text-violet-600 dark:text-violet-400">
                  {formatNumber(mdrData?.summary.settlementAmount || 0)}
                </p>
                <p className="text-sm text-muted-foreground">
                  [ MDR {formatNumber(mdrData?.summary.mdrSettlement || 0)} ]
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data Table */}
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead rowSpan={2} className="border-r bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-slate-100">Date</TableHead>
                    <TableHead colSpan={2} className="text-center bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-100 border-r font-bold">Deposit</TableHead>
                    <TableHead colSpan={2} className="text-center bg-cyan-100 dark:bg-cyan-900/40 text-cyan-900 dark:text-cyan-100 border-r font-bold">Topup</TableHead>
                    <TableHead colSpan={2} className="text-center bg-rose-100 dark:bg-rose-900/40 text-rose-900 dark:text-rose-100 border-r font-bold">Payout</TableHead>
                    <TableHead colSpan={2} className="text-center bg-violet-100 dark:bg-violet-900/40 text-violet-900 dark:text-violet-100 border-r font-bold">Settlement</TableHead>
                    <TableHead rowSpan={2} className="text-center bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-slate-100">Total<br/>MDR</TableHead>
                  </TableRow>
                  <TableRow>
                    <TableHead className="text-center bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-100 font-semibold text-xs">Total Deposit</TableHead>
                    <TableHead className="text-center bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-100 border-r font-semibold text-xs">MDR</TableHead>
                    <TableHead className="text-center bg-cyan-100 dark:bg-cyan-900/40 text-cyan-900 dark:text-cyan-100 font-semibold text-xs">Total Topup</TableHead>
                    <TableHead className="text-center bg-cyan-100 dark:bg-cyan-900/40 text-cyan-900 dark:text-cyan-100 border-r font-semibold text-xs">MDR</TableHead>
                    <TableHead className="text-center bg-rose-100 dark:bg-rose-900/40 text-rose-900 dark:text-rose-100 font-semibold text-xs">Total Payout</TableHead>
                    <TableHead className="text-center bg-rose-100 dark:bg-rose-900/40 text-rose-900 dark:text-rose-100 border-r font-semibold text-xs">MDR</TableHead>
                    <TableHead className="text-center bg-violet-100 dark:bg-violet-900/40 text-violet-900 dark:text-violet-100 font-semibold text-xs">Total Settlement</TableHead>
                    <TableHead className="text-center bg-violet-100 dark:bg-violet-900/40 text-violet-900 dark:text-violet-100 border-r font-semibold text-xs">MDR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8">
                        กำลังโหลดข้อมูล...
                      </TableCell>
                    </TableRow>
                  ) : queryError ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-destructive">
                        เกิดข้อผิดพลาด: {(queryError as Error).message}
                        <br />
                        <span className="text-sm text-muted-foreground">
                          กรุณาตรวจสอบว่าคุณมีสิทธิ์เข้าถึงข้อมูลหรือไม่
                        </span>
                      </TableCell>
                    </TableRow>
                  ) : mdrData?.paginatedData && mdrData.paginatedData.length > 0 ? (
                    mdrData.paginatedData.map((row, index) => (
                      <TableRow key={index} className="hover:bg-blue-50/30 dark:hover:bg-slate-900/50">
                        <TableCell className="border-r bg-white dark:bg-slate-950 font-semibold text-slate-900 dark:text-slate-100">{row.date}</TableCell>
                        <TableCell className="text-right bg-white dark:bg-emerald-950/20 text-slate-900 dark:text-slate-100 font-medium">{formatNumber(row.totalDeposit)}</TableCell>
                        <TableCell className="text-right bg-white dark:bg-emerald-950/20 border-r text-emerald-700 dark:text-emerald-400 font-bold">{formatNumber(row.mdrDeposit)}</TableCell>
                        <TableCell className="text-right bg-white dark:bg-cyan-950/20 text-slate-900 dark:text-slate-100 font-medium">{formatNumber(row.totalTopup)}</TableCell>
                        <TableCell className="text-right bg-white dark:bg-cyan-950/20 border-r text-cyan-700 dark:text-cyan-400 font-bold">{formatNumber(row.mdrTopup)}</TableCell>
                        <TableCell className="text-right bg-white dark:bg-rose-950/20 text-slate-900 dark:text-slate-100 font-medium">{formatNumber(row.totalPayout)}</TableCell>
                        <TableCell className="text-right bg-white dark:bg-rose-950/20 border-r text-rose-700 dark:text-rose-400 font-bold">{formatNumber(row.mdrPayout)}</TableCell>
                        <TableCell className="text-right bg-white dark:bg-violet-950/20 text-slate-900 dark:text-slate-100 font-medium">{formatNumber(row.totalSettlement)}</TableCell>
                        <TableCell className="text-right bg-white dark:bg-violet-950/20 border-r text-violet-700 dark:text-violet-400 font-bold">{formatNumber(row.mdrSettlement)}</TableCell>
                        <TableCell className="text-right bg-white dark:bg-slate-950 font-bold text-slate-900 dark:text-slate-100 text-base">{formatNumber(row.totalMDR)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        ไม่พบข้อมูลในช่วงเวลาที่เลือก
                        <br />
                        <span className="text-sm">
                          กรุณาเปลี่ยนช่วงวันที่
                        </span>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Pagination Controls */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-4">
              {/* Items per page selector - Left */}
              <div className="flex items-center gap-2 justify-start">
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

              {/* Pagination - Center */}
              <div className="flex justify-center">
                {mdrData && mdrData.totalPages > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: Math.min(5, mdrData.totalPages) }, (_, i) => {
                      let pageNum;
                      if (mdrData.totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (page <= 3) {
                        pageNum = i + 1;
                      } else if (page >= mdrData.totalPages - 2) {
                        pageNum = mdrData.totalPages - 4 + i;
                      } else {
                        pageNum = page - 2 + i;
                      }
                      
                      return (
                        <PaginationItem key={pageNum}>
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
                    
                    {mdrData.totalPages > 5 && page < mdrData.totalPages - 2 && (
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setPage(p => Math.min(mdrData.totalPages, p + 1))}
                        className={page === mdrData.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                  </Pagination>
                )}
              </div>

              {/* Page info - Right */}
              <div className="text-sm text-muted-foreground text-right">
                หน้า {page} จาก {mdrData?.totalPages || 0} ({mdrData?.dailyData?.length || 0} รายการทั้งหมด)
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default MDR;