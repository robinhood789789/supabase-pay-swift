import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatCurrency, cn } from "@/lib/utils";
import { Search, TrendingUp, Wallet, Users, Download, ChevronRight, CalendarIcon, ChevronDown, DollarSign, Percent, TestTube, RotateCcw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { th } from "date-fns/locale";
import JSZip from "jszip";
import { mockPlatformMDRData, mockPlatformMDRSummary } from "@/data/mockPlatformMDR";
import { mockShareholdersList, mockShareholdersSummary } from "@/data/mockShareholdersList";

interface ClientMDRData {
  tenant_id: string;
  tenant_name: string;
  owner_name: string;
  shareholder_id: string;
  shareholder_name: string;
  total_transfer_amount: number;
  shareholder_commission_rate: number;
  shareholder_commission_amount: number;
}

export default function PlatformShareholderEarnings() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState("all");
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "custom">("month");
  const [customStartDate, setCustomStartDate] = useState<Date>();
  const [customEndDate, setCustomEndDate] = useState<Date>();
  const [useMockMDR, setUseMockMDR] = useState(false);
  const [useMockShareholders, setUseMockShareholders] = useState(false);

  // Calculate date range based on selection
  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case "today":
        return {
          start: startOfDay(now),
          end: endOfDay(now),
        };
      case "week":
        return {
          start: startOfWeek(now, { weekStartsOn: 0 }),
          end: endOfWeek(now, { weekStartsOn: 0 }),
        };
      case "month":
        return {
          start: startOfMonth(now),
          end: endOfMonth(now),
        };
      case "custom":
        return {
          start: customStartDate ? startOfDay(customStartDate) : undefined,
          end: customEndDate ? endOfDay(customEndDate) : undefined,
        };
      default:
        return { start: undefined, end: undefined };
    }
  };

  const { start: startDate, end: endDate } = getDateRange();

  // Reset all filters
  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedTab("all");
    setDateRange("month");
    setCustomStartDate(undefined);
    setCustomEndDate(undefined);
  };

  // Check if any filter is active
  const hasActiveFilters = searchTerm !== "" || selectedTab !== "all" || dateRange !== "month";

  // Export to CSV function
  const handleExportCSV = () => {
    if (!filteredShareholders || filteredShareholders.length === 0) {
      return;
    }

    // Prepare metadata
    const exportDate = format(new Date(), "d MMMM yyyy HH:mm:ss", { locale: th });
    const dateRangeText = startDate && endDate
      ? `${format(startDate, "d MMM yyyy", { locale: th })} - ${format(endDate, "d MMM yyyy", { locale: th })}`
      : "ทั้งหมด";
    const statusFilterText = selectedTab === "all" ? "ทั้งหมด" : selectedTab === "active" ? "Active" : "Inactive";
    const totalRecords = filteredShareholders.length;

    // Metadata rows
    const metadata = [
      `"รายงานรายได้ Shareholder"`,
      `"วันที่ส่งออก:","${exportDate}"`,
      `"ช่วงเวลา:","${dateRangeText}"`,
      `"สถานะ:","${statusFilterText}"`,
      `"รายการทั้งหมด:","${totalRecords}"`,
      `"ยอดเงินคงเหลือรวม:","${formatCurrency(platformSummary.totalEarnings)}"`,
      `"เบิกแล้ว:","${formatCurrency(platformSummary.paidEarnings)}"`,
      "", // Empty line separator
    ];

    // Prepare CSV headers
    const headers = [
      "ชื่อ Shareholder",
      "Email",
      "Public ID",
      "สถานะ",
      "จำนวนลูกค้า",
      "ยอดเงินคงเหลือ (บาท)",
      "เบิกแล้ว (บาท)",
    ];

    // Prepare CSV rows
    const rows = filteredShareholders.map((sh) => [
      sh.full_name || "-",
      sh.email || "-",
      sh.profile?.public_id || "-",
      sh.status === "active" ? "Active" : "Inactive",
      sh.active_clients_count || 0,
      (sh.total_earnings / 100).toFixed(2),
      (sh.paid_earnings / 100).toFixed(2),
    ]);

    // Create CSV content with metadata
    const csvContent = [
      ...metadata,
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    // Add BOM for Thai language support in Excel
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    
    // Create download link
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    
    // Generate filename with date range
    const dateRangeStr = startDate && endDate
      ? `_${format(startDate, "yyyyMMdd")}-${format(endDate, "yyyyMMdd")}`
      : `_${format(new Date(), "yyyyMMdd")}`;
    link.setAttribute("download", `shareholder_earnings${dateRangeStr}.csv`);
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export detailed CSV with transactions
  const handleExportDetailedCSV = async () => {
    const shareholdersToExport = filteredShareholders;
    
    if (!shareholdersToExport || shareholdersToExport.length === 0) {
      return;
    }

    const zip = new JSZip();
    const exportDate = format(new Date(), "d MMMM yyyy HH:mm:ss", { locale: th });
    const dateRangeText = startDate && endDate
      ? `${format(startDate, "d MMM yyyy", { locale: th })} - ${format(endDate, "d MMM yyyy", { locale: th })}`
      : "ทั้งหมด";

    // Create summary file for selected shareholders only
    const summaryMetadata = [
      `"รายงานรายได้ Shareholder (สรุป)"`,
      `"วันที่ส่งออก:","${exportDate}"`,
      `"ช่วงเวลา:","${dateRangeText}"`,
      `"จำนวนรายการที่เลือก:","${shareholdersToExport.length}"`,
      `"ยอดเงินคงเหลือรวมที่เลือก:","${formatCurrency(shareholdersToExport.reduce((sum, sh) => sum + sh.total_earnings, 0))}"`,
      "",
    ];

    const summaryHeaders = ["ชื่อ Shareholder", "Email", "Public ID", "สถานะ", "จำนวนลูกค้า", "ยอดเงินคงเหลือ (บาท)", "เบิกแล้ว (บาท)"];
    const summaryRows = shareholdersToExport.map((sh) => [
      sh.full_name || "-",
      sh.email || "-",
      sh.profile?.public_id || "-",
      sh.status === "active" ? "Active" : "Inactive",
      sh.active_clients_count || 0,
      (sh.total_earnings / 100).toFixed(2),
      (sh.paid_earnings / 100).toFixed(2),
    ]);

    const summaryContent = [
      ...summaryMetadata,
      summaryHeaders.join(","),
      ...summaryRows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const BOM = "\uFEFF";
    zip.file("00_summary.csv", BOM + summaryContent);

    // Fetch and create detailed files for each selected shareholder
    for (const shareholder of shareholdersToExport) {
      try {
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

        if (startDate) {
          query = query.gte("created_at", startDate.toISOString());
        }
        if (endDate) {
          query = query.lte("created_at", endDate.toISOString());
        }

        const { data: earningsData } = await query;

        if (earningsData && earningsData.length > 0) {
          const detailMetadata = [
            `"รายละเอียดรายได้: ${shareholder.full_name}"`,
            `"Public ID:","${shareholder.profile?.public_id || "-"}"`,
            `"Email:","${shareholder.email}"`,
            `"วันที่ส่งออก:","${exportDate}"`,
            `"ช่วงเวลา:","${dateRangeText}"`,
            `"จำนวนธุรกรรม:","${earningsData.length}"`,
            `"ยอดเงินคงเหลือรวม:","${formatCurrency(shareholder.total_earnings)}"`,
            "",
          ];

          const detailHeaders = [
            "วันที่",
            "ลูกค้า",
            "Public ID ลูกค้า",
            "ยอดฐาน (บาท)",
            "อัตรา (%)",
            "รายได้ (บาท)",
            "สถานะ",
          ];

          const detailRows = earningsData.map((earning: any) => [
            format(new Date(earning.created_at), "dd/MM/yyyy HH:mm"),
            earning.tenants?.name || "-",
            earning.tenants?.profiles?.public_id || "-",
            (earning.base_amount / 100).toFixed(2),
            earning.commission_rate,
            (earning.amount / 100).toFixed(2),
            earning.status === "paid" ? "เบิกแล้ว" : earning.status === "pending" ? "รอจ่าย" : "ยกเลิก",
          ]);

          const detailContent = [
            ...detailMetadata,
            detailHeaders.join(","),
            ...detailRows.map(row => row.map(cell => `"${cell}"`).join(","))
          ].join("\n");

          const publicId = shareholder.profile?.public_id || shareholder.id.substring(0, 8);
          zip.file(`${publicId}_${shareholder.full_name?.replace(/[^a-zA-Z0-9ก-๙]/g, "_") || "unnamed"}.csv`, BOM + detailContent);
        }
      } catch (error) {
        console.error(`Error fetching earnings for shareholder ${shareholder.id}:`, error);
      }
    }

    // Generate ZIP file
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(zipBlob);
    link.setAttribute("href", url);
    
    const dateRangeStr = startDate && endDate
      ? `_${format(startDate, "yyyyMMdd")}-${format(endDate, "yyyyMMdd")}`
      : `_${format(new Date(), "yyyyMMdd")}`;
    link.setAttribute("download", `shareholder_earnings_detailed${dateRangeStr}.zip`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Fetch all shareholders with their earnings
  const { data: shareholders, isLoading } = useQuery({
    queryKey: ["platform-shareholders-earnings", useMockShareholders],
    queryFn: async () => {
      if (useMockShareholders) {
        return mockShareholdersList;
      }

      const { data: shareholdersData, error } = await supabase
        .from("shareholders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      if (!shareholdersData) return [];

      // Fetch profiles separately for each shareholder
      const shareholdersWithProfiles = await Promise.all(
        shareholdersData.map(async (sh) => {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("public_id, email, full_name")
            .eq("id", sh.user_id)
            .single();

          return {
            ...sh,
            profile: profileData || null
          };
        })
      );

      return shareholdersWithProfiles;
    },
  });

  // Fetch earnings summary with date filter
  const { data: earnings } = useQuery({
    queryKey: ["platform-earnings-summary", startDate, endDate, useMockShareholders],
    queryFn: async () => {
      if (useMockShareholders) {
        // Return mock earnings data derived from shareholders list
        return mockShareholdersList.flatMap(sh => [
          {
            shareholder_id: sh.id,
            amount: sh.pending_earnings,
            status: "pending",
            created_at: sh.updated_at,
          },
          {
            shareholder_id: sh.id,
            amount: sh.paid_earnings,
            status: "paid",
            created_at: sh.created_at,
          },
        ]);
      }

      let query = supabase
        .from("shareholder_earnings")
        .select("shareholder_id, amount, status, created_at");

      // Apply date filter if available
      if (startDate) {
        query = query.gte("created_at", startDate.toISOString());
      }
      if (endDate) {
        query = query.lte("created_at", endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
  });

  // Calculate summary for each shareholder
  const shareholdersWithEarnings = shareholders?.map((sh) => {
    const shareholderEarnings = earnings?.filter(e => e.shareholder_id === sh.id) || [];
    const total = shareholderEarnings.reduce((sum, e) => sum + e.amount, 0);
    const pending = shareholderEarnings.filter(e => e.status === "pending").reduce((sum, e) => sum + e.amount, 0);
    const paid = shareholderEarnings.filter(e => e.status === "paid").reduce((sum, e) => sum + e.amount, 0);

    return {
      ...sh,
      total_earnings: total,
      pending_earnings: pending,
      paid_earnings: paid,
    };
  });

  // Calculate platform summary
  const platformSummary = {
    totalEarnings: shareholdersWithEarnings?.reduce((sum, sh) => sum + sh.total_earnings, 0) || 0,
    pendingEarnings: shareholdersWithEarnings?.reduce((sum, sh) => sum + sh.pending_earnings, 0) || 0,
    paidEarnings: shareholdersWithEarnings?.reduce((sum, sh) => sum + sh.paid_earnings, 0) || 0,
    activeShareholders: shareholders?.filter(sh => sh.status === "active").length || 0,
  };

  // Filter shareholders
  const filteredShareholders = shareholdersWithEarnings?.filter((sh) => {
    const matchesSearch = 
      sh.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sh.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sh.profile?.public_id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTab = 
      selectedTab === "all" || 
      sh.status === selectedTab;

    return matchesSearch && matchesTab;
  });

  // Fetch MDR data for all shareholders and their clients
  const { data: mdrData, isLoading: mdrLoading } = useQuery({
    queryKey: ["platform-mdr-data", startDate, endDate, useMockMDR],
    queryFn: async () => {
      // Use mock data if enabled
      if (useMockMDR) {
        return mockPlatformMDRData as ClientMDRData[];
      }

      const startDateStr = startDate ? format(startDate, "yyyy-MM-dd") : format(startOfMonth(new Date()), "yyyy-MM-dd");
      const endDateStr = endDate ? format(endDate, "yyyy-MM-dd") : format(endOfMonth(new Date()), "yyyy-MM-dd");

      // Get all shareholder-client relationships
      const { data: clientRelations, error: relationsError } = await supabase
        .from("shareholder_clients")
        .select("tenant_id, shareholder_id, commission_rate")
        .eq("status", "active");

      if (relationsError) throw relationsError;
      if (!clientRelations || clientRelations.length === 0) return [];

      // Fetch related data separately
      const enrichedRelations = await Promise.all(
        clientRelations.map(async (relation) => {
          // Fetch tenant data
          const { data: tenantData } = await supabase
            .from("tenants")
            .select("name, user_id")
            .eq("id", relation.tenant_id)
            .single();

          // Fetch tenant owner profile
          const { data: ownerProfile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", tenantData?.user_id)
            .single();

          // Fetch shareholder data
          const { data: shareholderData } = await supabase
            .from("shareholders")
            .select("user_id")
            .eq("id", relation.shareholder_id)
            .single();

          // Fetch shareholder profile
          const { data: shareholderProfile } = await supabase
            .from("profiles")
            .select("full_name, public_id")
            .eq("id", shareholderData?.user_id)
            .single();

          return {
            ...relation,
            tenants: {
              name: tenantData?.name,
              user_id: tenantData?.user_id,
              profiles: ownerProfile
            },
            shareholders: {
              user_id: shareholderData?.user_id,
              profiles: shareholderProfile
            }
          };
        })
      );

      // For each client, fetch transaction data
      const mdrPromises = enrichedRelations.map(async (relation) => {
        // Fetch deposit_transfers
        const { data: deposits } = await supabase
          .from("deposit_transfers")
          .select("amountpaid")
          .gte("depositdate", startDateStr)
          .lte("depositdate", endDateStr);

        // Fetch topup_transfers  
        const { data: topups } = await supabase
          .from("topup_transfers")
          .select("amount")
          .gte("transfer_date", startDateStr)
          .lte("transfer_date", endDateStr);

        // Fetch settlement_transfers
        const { data: settlements } = await supabase
          .from("settlement_transfers")
          .select("amount")
          .gte("created_at", startDateStr)
          .lte("created_at", endDateStr);

        const totalDeposit = deposits?.reduce((sum, d) => sum + (Number(d.amountpaid) || 0), 0) || 0;
        const totalTopup = topups?.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;
        const totalSettlement = settlements?.reduce((sum, s) => sum + (Number(s.amount) || 0), 0) || 0;
        const totalPayout = 0;

        const shareholderRate = relation.commission_rate / 100;
        const totalTransferAmount = totalDeposit + totalTopup + totalPayout + totalSettlement;
        const shareholderCommission = totalTransferAmount * shareholderRate;

        return {
          tenant_id: relation.tenant_id,
          tenant_name: (relation.tenants as any).name,
          owner_name: (relation.tenants as any).profiles?.full_name || "N/A",
          shareholder_id: relation.shareholder_id,
          shareholder_name: (relation.shareholders as any).profiles?.full_name || "N/A",
          total_transfer_amount: totalTransferAmount,
          shareholder_commission_rate: relation.commission_rate,
          shareholder_commission_amount: shareholderCommission,
        } as ClientMDRData;
      });

      const results = await Promise.all(mdrPromises);
      return results.filter(r => r.total_transfer_amount > 0); // Only show clients with transactions
    },
    enabled: !useMockMDR, // Only fetch real data when not using mock
  });

  // Calculate MDR summary
  const mdrSummary = useMockMDR 
    ? mockPlatformMDRSummary 
    : mdrData?.reduce(
    (acc, curr) => ({
      totalTransferAmount: acc.totalTransferAmount + curr.total_transfer_amount,
      totalCommission: acc.totalCommission + curr.shareholder_commission_amount,
    }),
    { totalTransferAmount: 0, totalCommission: 0 }
  );

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">รายงานรายได้ Shareholder</h1>
          <p className="text-muted-foreground mt-2">
            ภาพรวมรายได้ของ Shareholder ทั้งหมดในระบบ
            {startDate && endDate && (
              <span className="ml-2 text-foreground font-medium">
                ({format(startDate, "d MMM", { locale: th })} - {format(endDate, "d MMM yyyy", { locale: th })})
              </span>
            )}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline"
              disabled={!filteredShareholders || filteredShareholders.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              ส่งออก CSV ({filteredShareholders?.length || 0} รายการ)
              <ChevronDown className="w-4 h-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportCSV}>
              <Download className="w-4 h-4 mr-2" />
              ส่งออกแบบสรุป
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={handleExportDetailedCSV}
            >
              <Download className="w-4 h-4 mr-2" />
              ส่งออกแบบละเอียด (ทั้งหมด)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Platform Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ยอดเงินคงเหลือ</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(platformSummary.totalEarnings)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">รายได้ที่เบิกแล้ว</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-green-600">{formatCurrency(platformSummary.paidEarnings)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Shareholder ที่ Active</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{platformSummary.activeShareholders}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Shareholders List */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>รายชื่อ Shareholder และรายได้</CardTitle>
              <CardDescription>รายละเอียดรายได้ของแต่ละ Shareholder</CardDescription>
            </div>
            <Button
              variant={useMockShareholders ? "default" : "outline"}
              size="sm"
              onClick={() => setUseMockShareholders(!useMockShareholders)}
              className="gap-2"
            >
              <TestTube className="h-4 w-4" />
              {useMockShareholders ? "ข้อมูลจำลอง" : "ข้อมูลจริง"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters Row */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาชื่อ, อีเมล หรือ Public ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Date Range Filter */}
            <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="เลือกช่วงเวลา" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">วันนี้</SelectItem>
                <SelectItem value="week">สัปดาห์นี้</SelectItem>
                <SelectItem value="month">เดือนนี้</SelectItem>
                <SelectItem value="custom">กำหนดเอง</SelectItem>
              </SelectContent>
            </Select>

            {/* Custom Date Range Pickers */}
            {dateRange === "custom" && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[200px] justify-start text-left font-normal",
                        !customStartDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customStartDate ? format(customStartDate, "d MMM yyyy", { locale: th }) : "วันที่เริ่มต้น"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customStartDate}
                      onSelect={setCustomStartDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[200px] justify-start text-left font-normal",
                        !customEndDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customEndDate ? format(customEndDate, "d MMM yyyy", { locale: th }) : "วันที่สิ้นสุด"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customEndDate}
                      onSelect={setCustomEndDate}
                      disabled={(date) => customStartDate ? date < customStartDate : false}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </>
            )}

            {/* Reset Filters Button */}
            {hasActiveFilters && (
              <Button
                variant="outline"
                onClick={handleResetFilters}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                รีเซ็ตตัวกรอง
              </Button>
            )}
          </div>

          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="mb-4">
            <TabsList>
              <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="inactive">Inactive</TabsTrigger>
            </TabsList>
          </Tabs>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : filteredShareholders && filteredShareholders.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shareholder</TableHead>
                  <TableHead>Public ID</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>ลูกค้า</TableHead>
                  <TableHead>ยอดเงินคงเหลือ</TableHead>
                  <TableHead>เบิกแล้ว</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredShareholders.map((shareholder) => (
                  <TableRow key={shareholder.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{shareholder.full_name}</div>
                        <div className="text-sm text-muted-foreground">{shareholder.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {shareholder.profile?.public_id || "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={shareholder.status === "active" ? "default" : "secondary"}>
                        {shareholder.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {shareholder.active_clients_count || 0} ลูกค้า
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold">
                      {formatCurrency(shareholder.total_earnings)}
                    </TableCell>
                    <TableCell className="font-semibold text-green-600">
                      {formatCurrency(shareholder.paid_earnings)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.location.href = `/platform/partners/${shareholder.id}`}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              ไม่พบข้อมูล Shareholder
            </div>
          )}
        </CardContent>
      </Card>

      {/* MDR Table Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>รายละเอียดการคำนวณ MDR และค่าคอมมิชชั่น</CardTitle>
              <CardDescription>
                แสดงการคำนวณ MDR และค่าคอมมิชชั่นของทุก Shareholder
                {startDate && endDate && (
                  <span className="ml-2 font-medium text-foreground">
                    ({format(startDate, "d MMM", { locale: th })} - {format(endDate, "d MMM yyyy", { locale: th })})
                  </span>
                )}
              </CardDescription>
            </div>
            <Button
              variant={useMockMDR ? "default" : "outline"}
              size="sm"
              onClick={() => setUseMockMDR(!useMockMDR)}
              className="gap-2"
            >
              <TestTube className="h-4 w-4" />
              {useMockMDR ? "ข้อมูลจำลอง" : "ข้อมูลจริง"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* MDR Summary Cards */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 mb-6">
            <Card className="border border-border shadow-soft bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  ยอดการโอนรวมทั้งหมด
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {mdrLoading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <div className="text-2xl font-bold text-foreground">
                    {formatCurrency(mdrSummary?.totalTransferAmount || 0)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border border-emerald-200 shadow-soft bg-emerald-50 dark:bg-emerald-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  ค่าคอมมิชชั่นรวมทั้งหมด
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {mdrLoading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(mdrSummary?.totalCommission || 0)}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* MDR Detail Table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              {mdrLoading ? (
                <div className="space-y-2 p-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : mdrData && mdrData.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="border-r bg-white dark:bg-slate-950 font-semibold">Shareholder</TableHead>
                      <TableHead className="border-r bg-white dark:bg-slate-950 font-semibold">ลูกค้า</TableHead>
                      <TableHead className="border-r bg-white dark:bg-slate-950 font-semibold">Owner</TableHead>
                      <TableHead className="text-right border-r bg-emerald-100 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-400 font-semibold">
                        ยอดการโอน
                      </TableHead>
                      <TableHead className="text-right border-r bg-blue-100 dark:bg-blue-950/20 text-foreground dark:text-blue-400 font-semibold">
                        <div className="flex items-center justify-end gap-1">
                          <Percent className="h-3 w-3" />
                          Shareholder
                        </div>
                      </TableHead>
                      <TableHead className="text-right bg-blue-100 dark:bg-blue-950/20 text-blue-900 dark:text-blue-400 font-semibold">
                        ส่วนแบ่ง Shareholder
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mdrData.map((row, idx) => (
                      <TableRow key={`${row.shareholder_id}-${row.tenant_id}-${idx}`}>
                        <TableCell className="border-r font-medium">
                          <div className="flex flex-col">
                            <span className="font-semibold">{row.shareholder_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="border-r font-medium">
                          {row.tenant_name}
                        </TableCell>
                        <TableCell className="border-r text-muted-foreground">
                          {row.owner_name}
                        </TableCell>
                        <TableCell className="text-right border-r font-semibold bg-emerald-50 dark:bg-emerald-950/10">
                          {formatCurrency(row.total_transfer_amount)}
                        </TableCell>
                        <TableCell className="text-right border-r font-medium bg-blue-50 dark:bg-blue-950/10">
                          {row.shareholder_commission_rate.toFixed(2)}%
                        </TableCell>
                        <TableCell className="text-right font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/10">
                          {formatCurrency(row.shareholder_commission_amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  ไม่พบข้อมูล MDR ในช่วงเวลาที่เลือก
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
