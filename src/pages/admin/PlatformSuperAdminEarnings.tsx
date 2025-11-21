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

  // Fetch shareholder earnings data (connected to MDR table)
  const { data: shareholderEarningsData, isLoading: earningsLoading } = useQuery({
    queryKey: ["super-admin-shareholder-earnings", start, end, startDate, endDate],
    queryFn: async () => {
      // Fetch shareholder earnings and related data
      const { data: earningsData, error: earningsError } = await supabase
        .from("shareholder_earnings")
        .select(`
          shareholder_id,
          base_amount,
          amount,
          commission_rate,
          created_at,
          shareholders!inner (
            id,
            user_id
          )
        `)
        .gte("created_at", start)
        .lte("created_at", end);

      if (earningsError) throw earningsError;

      // Fetch shareholder profiles for public_id
      const shareholderIds = [...new Set(earningsData?.map(e => e.shareholders.user_id) || [])];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, public_id")
        .in("id", shareholderIds);

      const profileMap = new Map(profilesData?.map(p => [p.id, p.public_id]) || []);

      // Group by shareholder
      const grouped = new Map();
      earningsData?.forEach(earning => {
        const shareholderId = earning.shareholder_id;
        const shareholderPublicId = profileMap.get(earning.shareholders.user_id) || "N/A";
        
        if (grouped.has(shareholderId)) {
          const existing = grouped.get(shareholderId);
          existing.total_base_amount += earning.base_amount;
          existing.total_commission += earning.amount;
          existing.transfer_count += 1;
        } else {
          grouped.set(shareholderId, {
            shareholder_id: shareholderId,
            shareholder_public_id: shareholderPublicId,
            total_base_amount: earning.base_amount,
            total_commission: earning.amount,
            commission_rate: earning.commission_rate,
            transfer_count: 1,
          });
        }
      });

      return Array.from(grouped.values());
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const shareholderPercentage = 0.5; // Shareholder's share (0.5% of total MDR)
  
  // Calculate summary metrics from shareholder earnings
  const calculateMetrics = () => {
    const totalRevenue = shareholderEarningsData?.reduce((sum, e) => sum + e.total_base_amount, 0) || 0;
    const totalCommissions = shareholderEarningsData?.reduce((sum, e) => sum + e.total_commission, 0) || 0;
    const netEarnings = totalRevenue - totalCommissions;
    const commissionRate = totalRevenue > 0 ? (totalCommissions / totalRevenue) * 100 : 0;
    const superAdminShare = totalRevenue * (superAdminPercentage / 100);

    return {
      totalRevenue,
      totalCommissions,
      netEarnings,
      commissionRate,
      superAdminShare,
      transferCount: shareholderEarningsData?.reduce((sum, e) => sum + e.transfer_count, 0) || 0,
    };
  };

  const metrics = calculateMetrics();

  // Use shareholder earnings data directly (already grouped)
  const groupedTransfers = useMemo(() => {
    if (!shareholderEarningsData) return [];

    return shareholderEarningsData
      .map(earning => ({
        shareholderId: earning.shareholder_public_id,
        totalAmount: earning.total_base_amount,
        totalCommission: earning.total_commission,
        commissionRate: earning.commission_rate,
        count: earning.transfer_count,
      }))
      .sort((a, b) => a.shareholderId.localeCompare(b.shareholderId));
  }, [shareholderEarningsData, startDate, endDate]);

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
  }, [shareholderEarningsData]);

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

  const isLoading = earningsLoading;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Super Admin Earnings</h1>
          <p className="text-muted-foreground">
            Platform revenue after shareholder commissions
          </p>
        </div>
        <Button onClick={handleExportCSV} disabled={isLoading}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
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
                <TableHead>Shareholder man share</TableHead>
                <TableHead>Super Admin Share ({superAdminPercentage}%)</TableHead>
                <TableHead>Transfer Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : paginatedTransfers && paginatedTransfers.length > 0 ? (
                paginatedTransfers.map((group, index) => {
                  const superAdminShare = group.totalAmount * (superAdminPercentage / 100); // 1%
                  const shareholderManShare = group.totalCommission; // Already calculated commission from MDR
                  const mdrAmount = group.totalCommission; // Total commission from earnings
                  const mdrRate = group.commissionRate || 1.5; // Use actual commission rate
                  const shareholderShare = shareholderPercentage;

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
                        {formatCurrency(mdrAmount)}
                        <span className="text-xs text-muted-foreground ml-2">
                          ({mdrRate.toFixed(1)}%)
                        </span>
                      </TableCell>
                      <TableCell className="font-bold text-muted-foreground">
                        {formatCurrency(shareholderManShare)}
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
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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

