import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatCurrency, cn } from "@/lib/utils";
import { Search, TrendingUp, Wallet, Clock, Users, Download, ChevronRight, CalendarIcon, X, ChevronDown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { th } from "date-fns/locale";
import JSZip from "jszip";

export default function PlatformShareholderEarnings() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState("all");
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "custom">("month");
  const [customStartDate, setCustomStartDate] = useState<Date>();
  const [customEndDate, setCustomEndDate] = useState<Date>();
  const [selectedShareholders, setSelectedShareholders] = useState<Set<string>>(new Set());

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
    setSelectedShareholders(new Set());
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
      `"จำนวนรายการ:","${totalRecords}"`,
      `"รายได้รวม:","${formatCurrency(platformSummary.totalEarnings)}"`,
      `"รายได้รอจ่าย:","${formatCurrency(platformSummary.pendingEarnings)}"`,
      `"รายได้ที่จ่ายแล้ว:","${formatCurrency(platformSummary.paidEarnings)}"`,
      "", // Empty line separator
    ];

    // Prepare CSV headers
    const headers = [
      "ชื่อ Shareholder",
      "Email",
      "Public ID",
      "สถานะ",
      "จำนวนลูกค้า",
      "รายได้ทั้งหมด (บาท)",
      "รอจ่าย (บาท)",
      "จ่ายแล้ว (บาท)",
    ];

    // Prepare CSV rows
    const rows = filteredShareholders.map((sh) => [
      sh.full_name || "-",
      sh.email || "-",
      sh.profile?.public_id || "-",
      sh.status === "active" ? "Active" : "Inactive",
      sh.active_clients_count || 0,
      (sh.total_earnings / 100).toFixed(2),
      (sh.pending_earnings / 100).toFixed(2),
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
    const shareholdersToExport = filteredShareholders?.filter(sh => selectedShareholders.has(sh.id));
    
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
      `"รายได้รวมที่เลือก:","${formatCurrency(shareholdersToExport.reduce((sum, sh) => sum + sh.total_earnings, 0))}"`,
      "",
    ];

    const summaryHeaders = ["ชื่อ Shareholder", "Email", "Public ID", "สถานะ", "จำนวนลูกค้า", "รายได้ทั้งหมด (บาท)", "รอจ่าย (บาท)", "จ่ายแล้ว (บาท)"];
    const summaryRows = shareholdersToExport.map((sh) => [
      sh.full_name || "-",
      sh.email || "-",
      sh.profile?.public_id || "-",
      sh.status === "active" ? "Active" : "Inactive",
      sh.active_clients_count || 0,
      (sh.total_earnings / 100).toFixed(2),
      (sh.pending_earnings / 100).toFixed(2),
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
            `"รายได้รวม:","${formatCurrency(shareholder.total_earnings)}"`,
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
            earning.status === "paid" ? "จ่ายแล้ว" : earning.status === "pending" ? "รอจ่าย" : "ยกเลิก",
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
    queryKey: ["platform-shareholders-earnings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shareholders")
        .select(`
          *,
          profiles!shareholders_user_id_fkey(public_id, email, full_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Transform the data to ensure profiles is a single object
      return data?.map(sh => ({
        ...sh,
        profile: Array.isArray(sh.profiles) ? sh.profiles[0] : sh.profiles
      }));
    },
  });

  // Fetch earnings summary with date filter
  const { data: earnings } = useQuery({
    queryKey: ["platform-earnings-summary", startDate, endDate],
    queryFn: async () => {
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

  // Handle select/deselect all shareholders
  const handleSelectAll = () => {
    if (filteredShareholders) {
      setSelectedShareholders(new Set(filteredShareholders.map(sh => sh.id)));
    }
  };

  const handleDeselectAll = () => {
    setSelectedShareholders(new Set());
  };

  // Toggle individual shareholder selection
  const toggleShareholderSelection = (shareholderId: string) => {
    const newSelection = new Set(selectedShareholders);
    if (newSelection.has(shareholderId)) {
      newSelection.delete(shareholderId);
    } else {
      newSelection.add(shareholderId);
    }
    setSelectedShareholders(newSelection);
  };

  // Check if all filtered shareholders are selected
  const allSelected = filteredShareholders && filteredShareholders.length > 0 && 
    filteredShareholders.every(sh => selectedShareholders.has(sh.id));

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
              disabled={selectedShareholders.size === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              ส่งออกแบบละเอียด ({selectedShareholders.size} ที่เลือก)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Platform Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">รายได้ทั้งหมด</CardTitle>
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
            <CardTitle className="text-sm font-medium">รายได้รอจ่าย</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(platformSummary.pendingEarnings)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">รายได้ที่จ่ายแล้ว</CardTitle>
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
          <CardTitle>รายชื่อ Shareholder และรายได้</CardTitle>
          <CardDescription>รายละเอียดรายได้ของแต่ละ Shareholder</CardDescription>
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
                <X className="h-4 w-4" />
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

          {/* Selection controls */}
          {filteredShareholders && filteredShareholders.length > 0 && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(checked) => {
                  if (checked) {
                    handleSelectAll();
                  } else {
                    handleDeselectAll();
                  }
                }}
              />
              <span className="text-sm font-medium">
                เลือกทั้งหมด ({selectedShareholders.size} / {filteredShareholders.length})
              </span>
              {selectedShareholders.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeselectAll}
                  className="ml-auto"
                >
                  <X className="w-4 h-4 mr-2" />
                  ยกเลิกการเลือก
                </Button>
              )}
            </div>
          )}

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
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          handleSelectAll();
                        } else {
                          handleDeselectAll();
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Shareholder</TableHead>
                  <TableHead>Public ID</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>ลูกค้า</TableHead>
                  <TableHead>รายได้ทั้งหมด</TableHead>
                  <TableHead>รอจ่าย</TableHead>
                  <TableHead>จ่ายแล้ว</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredShareholders.map((shareholder) => (
                  <TableRow key={shareholder.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedShareholders.has(shareholder.id)}
                        onCheckedChange={() => toggleShareholderSelection(shareholder.id)}
                      />
                    </TableCell>
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
                    <TableCell className="font-semibold text-orange-600">
                      {formatCurrency(shareholder.pending_earnings)}
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
    </div>
  );
}
