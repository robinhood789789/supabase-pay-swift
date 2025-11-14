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
  const [startDate, setStartDate] = useState("2025-07-01");
  const [endDate, setEndDate] = useState("2025-08-05");
  const [merchantFilter, setMerchantFilter] = useState("no13");
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Fetch and calculate MDR data from deposit_transfers
  const { data: mdrData, isLoading, refetch } = useQuery<{
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
    queryKey: ["mdr-report", startDate, endDate, merchantFilter, page, itemsPerPage],
    queryFn: async () => {
      // Query deposit_transfers data
      let query = (supabase as any)
        .from("deposit_transfers")
        .select("*")
        .gte("depositdate", startDate)
        .lte("depositdate", endDate)
        .order("depositdate", { ascending: true });

      if (merchantFilter && merchantFilter !== "all") {
        query = query.eq("memberid", merchantFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group data by date
      const dailyMap = new Map<string, DailyMDRData>();
      
      (data || []).forEach((item: any) => {
        const date = item.depositdate ? format(new Date(item.depositdate), "yyyy-MM-dd") : format(new Date(item.created_at), "yyyy-MM-dd");
        const merchant = item.memberid || "unknown";
        const amount = parseFloat(item.amountpaid || 0);
        
        if (!dailyMap.has(date)) {
          dailyMap.set(date, {
            date,
            merchant,
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
          // Calculate MDR (assume 1.6% for deposits)
          dayData.mdrDeposit += amount * 0.016;
          
          // For settlement (assuming all deposits go to settlement)
          dayData.totalSettlement += amount;
        }
        
        // Calculate total MDR
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
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-[180px]"
                />
              </div>
              
              <span className="text-muted-foreground pb-2">—</span>
              
              <div className="space-y-2">
                <Label className="invisible">End</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-[180px]"
                />
              </div>

              <div className="space-y-2">
                <Label>Merchant</Label>
                <div className="flex gap-2">
                  <Input
                    value={merchantFilter}
                    onChange={(e) => setMerchantFilter(e.target.value)}
                    placeholder="Merchant ID"
                    className="w-[200px]"
                  />
                  {merchantFilter && (
                    <Badge 
                      variant="secondary" 
                      className="px-3 py-2 cursor-pointer hover:bg-destructive"
                      onClick={() => setMerchantFilter("")}
                    >
                      {merchantFilter} ×
                    </Badge>
                  )}
                </div>
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
                <p className="text-3xl font-bold text-green-600">
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
                <p className="text-3xl font-bold text-blue-600">
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
                <p className="text-3xl font-bold text-red-600">
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
                <p className="text-3xl font-bold text-purple-600">
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
                    <TableHead rowSpan={2} className="border-r">Date</TableHead>
                    <TableHead rowSpan={2} className="border-r">Merchant</TableHead>
                    <TableHead colSpan={2} className="text-center bg-green-50 border-r">Deposit</TableHead>
                    <TableHead colSpan={2} className="text-center bg-blue-50 border-r">Topup</TableHead>
                    <TableHead colSpan={2} className="text-center bg-red-50 border-r">Payout</TableHead>
                    <TableHead colSpan={2} className="text-center bg-purple-50 border-r">Settlement</TableHead>
                    <TableHead rowSpan={2} className="text-center">Total<br/>MDR</TableHead>
                  </TableRow>
                  <TableRow>
                    <TableHead className="text-center bg-green-50">Total Deposit</TableHead>
                    <TableHead className="text-center bg-green-50 border-r">MDR</TableHead>
                    <TableHead className="text-center bg-blue-50">Total Topup</TableHead>
                    <TableHead className="text-center bg-blue-50 border-r">MDR</TableHead>
                    <TableHead className="text-center bg-red-50">Total Payout</TableHead>
                    <TableHead className="text-center bg-red-50 border-r">MDR</TableHead>
                    <TableHead className="text-center bg-purple-50">Total Settlement</TableHead>
                    <TableHead className="text-center bg-purple-50 border-r">MDR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : mdrData?.paginatedData && mdrData.paginatedData.length > 0 ? (
                    mdrData.paginatedData.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="border-r">{row.date}</TableCell>
                        <TableCell className="border-r">{row.merchant}</TableCell>
                        <TableCell className="text-right bg-green-50">{formatNumber(row.totalDeposit)}</TableCell>
                        <TableCell className="text-right bg-green-50 border-r">{formatNumber(row.mdrDeposit)}</TableCell>
                        <TableCell className="text-right bg-blue-50">{formatNumber(row.totalTopup)}</TableCell>
                        <TableCell className="text-right bg-blue-50 border-r">{formatNumber(row.mdrTopup)}</TableCell>
                        <TableCell className="text-right bg-red-50">{formatNumber(row.totalPayout)}</TableCell>
                        <TableCell className="text-right bg-red-50 border-r">{formatNumber(row.mdrPayout)}</TableCell>
                        <TableCell className="text-right bg-purple-50">{formatNumber(row.totalSettlement)}</TableCell>
                        <TableCell className="text-right bg-purple-50 border-r">{formatNumber(row.mdrSettlement)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatNumber(row.totalMDR)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                        No data found
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
                หน้า {page} จาก {mdrData?.totalPages || 0} ({mdrData?.dailyData?.length || 0} รายการทั้งหมด)
              </div>

              {/* Pagination */}
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
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default MDR;