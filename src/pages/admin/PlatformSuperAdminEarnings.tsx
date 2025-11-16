import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Download, TrendingUp, Wallet, Percent } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { mockIncomingTransfers } from "@/data/mockSuperAdminEarnings";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function PlatformSuperAdminEarnings() {
  const [useMockData, setUseMockData] = useState(true);
  const superAdminPercentage = 1; // Fixed percentage for Super Admin share (1% of each shareholder's total)
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  
  // Initialize with last 30 days
  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date;
  });
  const [endDate, setEndDate] = useState<Date>(new Date());

  const start = startDate.toISOString();
  const end = endDate.toISOString();

  // Fetch incoming transfers data
  const { data: transfersData, isLoading: transfersLoading } = useQuery({
    queryKey: ["super-admin-transfers", start, end, useMockData, startDate, endDate],
    queryFn: async () => {
      if (useMockData) {
        return Promise.resolve(mockIncomingTransfers);
      }

      const { data, error } = await supabase
        .from("incoming_transfers")
        .select("*")
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  // Calculate commissions (1.5% MDR rate)
  const AVERAGE_COMMISSION_RATE = 0.015;
  const shareholderPercentage = 0.5; // Fixed percentage for Shareholder share (0.5% of total)
  
  const commissionsData = transfersData?.map(transfer => ({
    transfer_id: transfer.id,
    commission_amount: Number(transfer.amount || 0) * AVERAGE_COMMISSION_RATE,
    occurred_at: transfer.created_at,
  })) || [];

  // Calculate summary metrics
  const calculateMetrics = () => {
    const totalRevenue = transfersData?.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;
    const totalCommissions = commissionsData.reduce((sum, c) => sum + c.commission_amount, 0);
    const netEarnings = totalRevenue - totalCommissions;
    const commissionRate = totalRevenue > 0 ? (totalCommissions / totalRevenue) * 100 : 0;
    const superAdminShare = totalRevenue * (superAdminPercentage / 100);

    return {
      totalRevenue,
      totalCommissions,
      netEarnings,
      commissionRate,
      superAdminShare,
      transferCount: transfersData?.length || 0,
    };
  };

  const metrics = calculateMetrics();

  // Group transfers by shareholder only
  const groupedTransfers = useMemo(() => {
    if (!transfersData) return [];

    const groups = new Map<string, {
      shareholderId: string;
      totalAmount: number;
      totalCommission: number;
      count: number;
    }>();

    transfersData.forEach((transfer) => {
      const shareholderId = transfer.shareholder_public_id || "N/A";
      const commission = commissionsData.find(c => c.transfer_id === transfer.id);
      const commissionAmount = commission?.commission_amount || 0;

      if (groups.has(shareholderId)) {
        const existing = groups.get(shareholderId)!;
        existing.totalAmount += Number(transfer.amount || 0);
        existing.totalCommission += commissionAmount;
        existing.count += 1;
      } else {
        groups.set(shareholderId, {
          shareholderId,
          totalAmount: Number(transfer.amount || 0),
          totalCommission: commissionAmount,
          count: 1,
        });
      }
    });

    return Array.from(groups.values()).sort((a, b) => 
      a.shareholderId.localeCompare(b.shareholderId)
    );
  }, [transfersData, commissionsData, startDate, endDate]);

  // Calculate pagination
  const totalPages = Math.ceil(groupedTransfers.length / itemsPerPage);
  const paginatedTransfers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return groupedTransfers.slice(startIndex, endIndex);
  }, [groupedTransfers, currentPage, itemsPerPage]);

  // Reset to page 1 when data changes
  useMemo(() => {
    setCurrentPage(1);
  }, [transfersData]);

  const handleExportCSV = () => {
    const dateRange = `${format(startDate, "dd MMM yyyy")} to ${format(endDate, "dd MMM yyyy")}`;
    const headers = ["Date Range", "Shareholder ID", "Total Amount", "Total Commission", "Net Amount", "Super Admin Share", "Transfer Count"];
    const rows = groupedTransfers.map((group) => {
      const netAmount = group.totalAmount - group.totalCommission;
      const superAdminShare = group.totalAmount * (superAdminPercentage / 100);
      
      return [
        dateRange,
        group.shareholderId,
        group.totalAmount,
        group.totalCommission,
        netAmount,
        superAdminShare,
        group.count,
      ].join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `super-admin-earnings-${format(startDate, "yyyy-MM-dd")}-to-${format(endDate, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isLoading = transfersLoading;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Super Admin Earnings</h1>
          <p className="text-muted-foreground">
            Platform revenue after shareholder commissions
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setUseMockData(!useMockData)}
          >
            {useMockData ? "Show Real Data" : "Show Mock Data"}
          </Button>
          <Button onClick={handleExportCSV} disabled={isLoading}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              From {metrics.transferCount} transfers
            </p>
          </CardContent>
        </Card>


        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Earnings</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(metrics.netEarnings)}</div>
            <p className="text-xs text-muted-foreground">
              After commissions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Super Admin Share</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(metrics.superAdminShare)}
            </div>
            <p className="text-xs text-muted-foreground">
              {superAdminPercentage}% of total revenue
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4">
        <div className="space-y-2">
          <Label>Start Date</Label>
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
                {startDate ? format(startDate, "dd/MM/yy") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(date) => date && setStartDate(date)}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>End Date</Label>
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
                {endDate ? format(endDate, "dd/MM/yy") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(date) => date && setEndDate(date)}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transfer Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date to Date</TableHead>
                <TableHead>Shareholder ID</TableHead>
                <TableHead>Total Deposits</TableHead>
                <TableHead>MDR (%)</TableHead>
                <TableHead>Total Commission</TableHead>
                <TableHead>Shareholder man share</TableHead>
                <TableHead>Super Admin Share ({superAdminPercentage}%)</TableHead>
                <TableHead>Transfer Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : paginatedTransfers && paginatedTransfers.length > 0 ? (
                paginatedTransfers.map((group, index) => {
                  const netAmount = group.totalAmount - group.totalCommission;
                  const superAdminShare = group.totalAmount * (superAdminPercentage / 100);
                  const mdrRate = 1.5; // Fixed MDR rate
                  const shareholderShare = 0.5; // Fixed Shareholder rate

                  return (
                    <TableRow key={`${group.shareholderId}-${index}`}>
                      <TableCell className="font-medium">
                        {format(startDate, "dd/MM/yy")} - {format(endDate, "dd/MM/yy")}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold">
                        {group.shareholderId}
                      </TableCell>
                      <TableCell className="font-bold text-green-600">
                        {formatCurrency(group.totalAmount)}
                      </TableCell>
                      <TableCell className="font-semibold text-blue-600">
                        {mdrRate.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-orange-600">
                        {formatCurrency(group.totalCommission)}
                      </TableCell>
                      <TableCell className="font-bold text-muted-foreground">
                        {formatCurrency(netAmount)}
                        <span className="text-xs text-muted-foreground ml-2">
                          ({shareholderShare.toFixed(1)}%)
                        </span>
                      </TableCell>
                      <TableCell className="font-bold text-primary">
                        {formatCurrency(superAdminShare)}
                        <span className="text-xs text-muted-foreground ml-2">
                          ({superAdminPercentage}%)
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {group.count} transfers
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No transfers found for selected period
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {groupedTransfers && groupedTransfers.length > 0 && (
            <div className="flex items-center justify-between px-2 py-4">
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, groupedTransfers.length)} of {groupedTransfers.length} results
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Rows per page:</span>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(value) => {
                      setItemsPerPage(Number(value));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[80px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  
                  {[...Array(totalPages)].map((_, i) => {
                    const pageNumber = i + 1;
                    // Show first page, last page, current page, and pages around current
                    if (
                      pageNumber === 1 ||
                      pageNumber === totalPages ||
                      (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                    ) {
                      return (
                        <PaginationItem key={pageNumber}>
                          <PaginationLink
                            onClick={() => setCurrentPage(pageNumber)}
                            isActive={currentPage === pageNumber}
                            className="cursor-pointer"
                          >
                            {pageNumber}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    } else if (
                      pageNumber === currentPage - 2 ||
                      pageNumber === currentPage + 2
                    ) {
                      return <PaginationItem key={pageNumber}>...</PaginationItem>;
                    }
                    return null;
                  })}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

