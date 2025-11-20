import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { DepositRequestDialog } from "@/components/DepositRequestDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { ChevronDown, ChevronUp, Calendar, Plus, Wallet, ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";
import { usePermissions } from "@/hooks/usePermissions";
import { useShareholder } from "@/hooks/useShareholder";
import { toast } from "sonner";

type PaymentStatus = "all" | "pending" | "completed" | "expired" | "rejected";

interface DepositTransfer {
  id: number;
  ref_id: string;
  custaccountname: string | null;
  custaccountnumber: string | null;
  amountpaid: number | null;
  bankcode: string | null;
  status: string | null;
  createdate: string | null;
  depositdate: string | null;
  tenant_id: string | null;
  adminbank_bankname: string | null;
  adminbank_bankaccountcode: string | null;
  custphonenumber: string | null;
  fullname: string | null;
  memberid: string | null;
  username: string | null;
}

export default function DepositList() {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const { shareholder, isShareholder } = useShareholder();
  const [statusFilter, setStatusFilter] = useState<PaymentStatus>("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [priority, setPriority] = useState("high");
  const [startDate, setStartDate] = useState("2025-05-01");
  const [endDate, setEndDate] = useState("2025-06-30");
  const [accName, setAccName] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterExpanded, setFilterExpanded] = useState(true);
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | "all">("all");

  const { activeTenantId, activeTenant } = useTenantSwitcher();
  const { hasPermission } = usePermissions();

  // Get shareholder view tenant from location state
  const shareholderViewTenantId = location.state?.tenantId;
  const shareholderViewTenantName = location.state?.tenantName;
  const shareholderViewOwnerName = location.state?.ownerName;
  
  // Redirect shareholder back to MDR if they access this page without tenant context
  useEffect(() => {
    if (isShareholder && !shareholderViewTenantId) {
      toast.error("กรุณาเลือก tenant จากหน้า MDR");
      navigate("/shareholder/mdr");
    }
  }, [isShareholder, shareholderViewTenantId, navigate]);
  
  // Determine which tenant to use
  const effectiveTenantId = isShareholder && shareholderViewTenantId 
    ? shareholderViewTenantId 
    : activeTenantId;

  // Verify shareholder access
  useEffect(() => {
    const verifyAccess = async () => {
      if (isShareholder && shareholderViewTenantId && shareholder?.id) {
        const { data, error } = await supabase
          .from("shareholder_clients")
          .select("*")
          .eq("shareholder_id", shareholder.id)
          .eq("tenant_id", shareholderViewTenantId)
          .eq("status", "active")
          .maybeSingle();

        if (error || !data) {
          toast.error("คุณไม่มีสิทธิ์เข้าถึงข้อมูลของ tenant นี้");
          return;
        }

        toast.success(`กำลังดูข้อมูลของ ${shareholderViewTenantName} (${shareholderViewOwnerName})`);
      }
    };

    verifyAccess();
  }, [isShareholder, shareholderViewTenantId, shareholder?.id, shareholderViewTenantName, shareholderViewOwnerName]);

  // Check user role
  const userRole = activeTenant?.roles?.name;
  const canCreateRequest = userRole === 'finance' || userRole === 'manager' || userRole === 'owner';

  // Fetch available owners for the tenant
  const { data: owners } = useQuery({
    queryKey: ["deposit-owners", effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      
      // Get owner counts filtered by tenant_id
      const { data: countData, error: countError } = await supabase
        .from("deposit_transfers")
        .select("owner_id")
        .eq("tenant_id", effectiveTenantId)
        .eq("status", "3");

      if (countError) throw countError;

      // Count by owner_id
      const ownerCounts = countData?.reduce((acc: Record<string, number>, item) => {
        if (item.owner_id) {
          acc[item.owner_id] = (acc[item.owner_id] || 0) + 1;
        }
        return acc;
      }, {});

      // Get unique owners with their profiles
      const uniqueOwnerIds = Object.keys(ownerCounts || {});
      
      if (uniqueOwnerIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, public_id")
        .in("id", uniqueOwnerIds);

      // Merge counts with profiles
      return (profiles || []).map(profile => ({
        ...profile,
        count: ownerCounts?.[profile.id] || 0
      }));
    },
    enabled: !!effectiveTenantId && isShareholder,
  });

  const { data: queryResult, isLoading, error: queryError, refetch } = useQuery<{ data: DepositTransfer[], count: number }>({
    queryKey: ["deposit-transfers", statusFilter, selectedOwnerId, page, itemsPerPage, effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) {
        return { data: [], count: 0 };
      }

      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      
      let query = (supabase as any)
        .from("deposit_transfers")
        .select("*", { count: 'exact' })
        .order("createdate", { ascending: false })
        .range(from, to);

      // Filter by tenant_id (critical for shareholder view)
      query = query.eq("tenant_id", effectiveTenantId);

      // Only filter by status 3
      query = query.eq("status", "3");

      // Filter by owner_id if selected
      if (selectedOwnerId && selectedOwnerId !== "all") {
        query = query.eq("owner_id", selectedOwnerId);
      }

      const { data, error, count } = await query;
      if (error) {
        console.error("❌ Query error:", error);
        throw error;
      }
      return { data: (data || []) as DepositTransfer[], count: count || 0 };
    },
    enabled: isShareholder && !!effectiveTenantId,
  });

  const deposits = queryResult?.data || [];
  const totalCount = queryResult?.count || 0;
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const statusButtons: { value: PaymentStatus; label: string }[] = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "completed", label: "Completed" },
    { value: "expired", label: "Expired" },
    { value: "rejected", label: "Rejected" },
  ];

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      completed: { label: "Completed", variant: "default" as const },
      succeeded: { label: "Completed", variant: "default" as const },
      pending: { label: "Pending", variant: "secondary" as const },
      processing: { label: "Processing", variant: "default" as const },
      expired: { label: "Expired", variant: "destructive" as const },
      rejected: { label: "Rejected", variant: "destructive" as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { 
      label: status, 
      variant: "secondary" as const 
    };

    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Allow access if user has permission OR if they're a shareholder viewing a client's data
  const hasAccess = hasPermission("deposits.view") || (isShareholder && shareholderViewTenantId);

  if (!hasAccess) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <h1 className="text-3xl font-bold">Topup List</h1>
          <p className="text-muted-foreground">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
          <p className="text-sm text-muted-foreground mt-2">Role: {userRole}</p>
        </div>
      </DashboardLayout>
    );
  }

  if (queryError) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <h1 className="text-3xl font-bold">Topup List</h1>
          <p className="text-destructive">เกิดข้อผิดพลาด: {queryError.message}</p>
          <Button onClick={() => refetch()} className="mt-4">ลองใหม่</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            {isShareholder && shareholderViewTenantId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/shareholder/mdr")}
                className="mb-2"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                กลับไปหน้า MDR
              </Button>
            )}
            <h1 className="text-3xl font-bold">Deposit List</h1>
            {shareholderViewTenantName && (
              <p className="text-muted-foreground">
                ข้อมูลของ {shareholderViewTenantName} ({shareholderViewOwnerName})
              </p>
            )}
          </div>
          {canCreateRequest && <DepositRequestDialog />}
        </div>

        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {statusButtons.map((btn) => (
                <Button
                  key={btn.value}
                  variant={statusFilter === btn.value ? "default" : "ghost"}
                  onClick={() => setStatusFilter(btn.value)}
                  size="sm"
                  className={statusFilter === btn.value ? "" : "text-muted-foreground"}
                >
                  {btn.label}
                </Button>
              ))}
            </div>

            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilterExpanded(!filterExpanded)}
                className="flex items-center gap-2 text-muted-foreground"
              >
                {filterExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Filter
              </Button>
            </div>

            {filterExpanded && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Owner</label>
                    <Select value={selectedOwnerId} onValueChange={(value) => {
                      setSelectedOwnerId(value);
                      setPage(1);
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">ทั้งหมด ({totalCount})</SelectItem>
                        {owners?.map((owner: any) => {
                          return (
                            <SelectItem key={owner.id} value={owner.id}>
                              {owner.full_name || owner.email} ({owner.count})
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Sort By</label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="created_at">Create At</SelectItem>
                        <SelectItem value="amount">Amount</SelectItem>
                        <SelectItem value="status">Status</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Priority</label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Start Date</label>
                    <div className="relative">
                      <Input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">End Date</label>
                    <div className="relative">
                      <Input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Text Filter</label>
                    <Input
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Acc Name</label>
                    <Select value={accName} onValueChange={setAccName}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Accounts</SelectItem>
                        <SelectItem value="account1">Account 1</SelectItem>
                        <SelectItem value="account2">Account 2</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Input
                    placeholder="Input search here..."
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Account Number</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    if (isLoading) {
                      return (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            Loading...
                          </TableCell>
                        </TableRow>
                      );
                    }
                    
                    if (!deposits || deposits.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                              <div className="text-4xl">📋</div>
                              <div>No incoming transfers found</div>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    }
                    
                    return deposits.map((transfer) => {
                      return (
                        <TableRow key={transfer.id}>
                          <TableCell className="text-xs text-muted-foreground">
                            {transfer.depositdate ? format(new Date(transfer.depositdate), "dd/MM/yyyy HH:mm") : 
                             transfer.createdate ? format(new Date(transfer.createdate), "dd/MM/yyyy HH:mm") : "-"}
                          </TableCell>
                          <TableCell>{transfer.custaccountname || transfer.fullname || "-"}</TableCell>
                          <TableCell className="font-mono text-xs">{transfer.custaccountnumber || "-"}</TableCell>
                          <TableCell>{transfer.bankcode || "-"}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {transfer.amountpaid ? `฿${Number(transfer.amountpaid).toLocaleString()}` : "-"}
                          </TableCell>
                          <TableCell>{getStatusBadge(transfer.status || "pending")}</TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm">
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
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
      </div>
    </DashboardLayout>
  );
}
