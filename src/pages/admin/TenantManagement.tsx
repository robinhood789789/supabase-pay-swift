import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Building2, Search, Eye, Settings, Loader2 } from "lucide-react";
import { ProvisionMerchantDialog } from "@/components/ProvisionMerchantDialog";
import { toast } from "sonner";

export default function TenantManagement() {
  const { user, isSuperAdmin, loading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editKycStatus, setEditKycStatus] = useState("");
  const [editBusinessType, setEditBusinessType] = useState("");
  const [editDepositPercent, setEditDepositPercent] = useState("");
  const [editWithdrawalPercent, setEditWithdrawalPercent] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const queryClient = useQueryClient();

  // Log page access
  useEffect(() => {
    if (user && isSuperAdmin) {
      supabase.from("audit_logs").insert({
        action: "super_admin.tenants.viewed",
        actor_user_id: user.id,
        ip: null,
        user_agent: navigator.userAgent,
      });
    }
  }, [user, isSuperAdmin]);

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["admin-tenants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*, memberships(count), tenant_settings(payment_deposit_percentage, payment_withdrawal_percentage), tenant_wallets(balance)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin,
  });

  const filteredTenants = tenants?.filter(
    (tenant) =>
      tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil((filteredTenants?.length || 0) / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTenants = filteredTenants?.slice(startIndex, endIndex);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const formatBalance = (balance: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 2,
    }).format(balance / 100);
  };

  const updateTenantMutation = useMutation({
    mutationFn: async ({ 
      tenantId, 
      status, 
      kycStatus, 
      businessType,
      depositPercent,
      withdrawalPercent
    }: { 
      tenantId: string; 
      status: string;
      kycStatus: string;
      businessType: string;
      depositPercent: number;
      withdrawalPercent: number;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("ไม่พบ session");
      }

      // Validate percentages
      if (depositPercent < 0 || depositPercent > 100) {
        throw new Error("Payment Deposit ต้องอยู่ระหว่าง 0-100%");
      }
      if (withdrawalPercent < 0 || withdrawalPercent > 100) {
        throw new Error("Payment Withdrawal ต้องอยู่ระหว่าง 0-100%");
      }

      // Update tenant status
      const { data: statusData, error: statusError } = await supabase.functions.invoke("update-tenant-status", {
        body: { tenant_id: tenantId, status },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (statusError) throw statusError;

      // Update KYC status and business type
      const { error: updateError } = await supabase
        .from("tenants")
        .update({ 
          kyc_status: kycStatus,
          business_type: businessType
        })
        .eq("id", tenantId);

      if (updateError) throw updateError;

      // Update payment percentages in tenant_settings
      const { error: settingsError } = await supabase
        .from("tenant_settings")
        .update({
          payment_deposit_percentage: depositPercent,
          payment_withdrawal_percentage: withdrawalPercent
        } as any)
        .eq("tenant_id", tenantId);

      if (settingsError) throw settingsError;

      return statusData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
      setEditDialogOpen(false);
      toast.success("อัพเดทข้อมูลสำเร็จ");
    },
    onError: (error: Error) => {
      console.error("Update tenant error:", error);
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    },
  });

  const handleOpenEditDialog = (tenant: any) => {
    setSelectedTenant(tenant);
    setEditStatus(tenant.status);
    setEditKycStatus(tenant.kyc_status || "pending");
    setEditBusinessType(tenant.business_type || "");
    setEditDepositPercent(String(tenant.tenant_settings?.[0]?.payment_deposit_percentage || 0));
    setEditWithdrawalPercent(String(tenant.tenant_settings?.[0]?.payment_withdrawal_percentage || 0));
    setEditDialogOpen(true);
  };

  const handleSaveChanges = () => {
    if (!selectedTenant) return;

    updateTenantMutation.mutate({
      tenantId: selectedTenant.id,
      status: editStatus,
      kycStatus: editKycStatus,
      businessType: editBusinessType,
      depositPercent: parseFloat(editDepositPercent) || 0,
      withdrawalPercent: parseFloat(editWithdrawalPercent) || 0,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/10 text-green-500";
      case "suspended":
        return "bg-red-500/10 text-red-500";
      case "locked":
        return "bg-orange-500/10 text-orange-500";
      case "pending":
        return "bg-yellow-500/10 text-yellow-500";
      default:
        return "bg-gray-500/10 text-gray-500";
    }
  };


  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-8 w-8" />
              Tenant Management
            </h1>
            <p className="text-muted-foreground">Manage and monitor all platform tenants</p>
          </div>
          <ProvisionMerchantDialog />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Tenants</CardTitle>
            <CardDescription>View and manage tenant accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tenants by name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Users</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Credit Balance</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : paginatedTenants?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center">
                          No tenants found
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedTenants?.map((tenant) => (
                        <TableRow key={tenant.id}>
                          <TableCell className="font-medium">{tenant.name}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(tenant.status)}>
                              {tenant.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{tenant.memberships?.[0]?.count || 0}</TableCell>
                          <TableCell>
                            {new Date(tenant.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatBalance(tenant.tenant_wallets?.[0]?.balance || 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleOpenEditDialog(tenant)}
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <Pagination className="mt-4">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <PaginationItem key={page}>
                      <PaginationLink
                        onClick={() => setCurrentPage(page)}
                        isActive={currentPage === page}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  ))}

                  <PaginationItem>
                    <span className="px-3 text-sm text-muted-foreground select-none">
                      Page {currentPage} of {totalPages}
                    </span>
                  </PaginationItem>

                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </CardContent>
        </Card>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Tenant</DialogTitle>
              <DialogDescription>
                Update tenant status, KYC status, and business type
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="tenant-name">Tenant Name</Label>
                <Input 
                  id="tenant-name" 
                  value={selectedTenant?.name || ""} 
                  disabled 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        Active
                      </div>
                    </SelectItem>
                    <SelectItem value="suspended">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        Suspended
                      </div>
                    </SelectItem>
                    <SelectItem value="locked">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-orange-500" />
                        Locked
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="kyc-status">KYC Status</Label>
                <Select value={editKycStatus} onValueChange={setEditKycStatus}>
                  <SelectTrigger id="kyc-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="business-type">Business Type</Label>
                <Input 
                  id="business-type"
                  value={editBusinessType}
                  onChange={(e) => setEditBusinessType(e.target.value)}
                  placeholder="e.g., E-commerce, Retail, Services"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deposit-percent">Payment Deposit (%)</Label>
                <Input 
                  id="deposit-percent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={editDepositPercent}
                  onChange={(e) => setEditDepositPercent(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="withdrawal-percent">Payment Withdrawal (%)</Label>
                <Input 
                  id="withdrawal-percent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={editWithdrawalPercent}
                  onChange={(e) => setEditWithdrawalPercent(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                disabled={updateTenantMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveChanges}
                disabled={updateTenantMutation.isPending}
              >
                {updateTenantMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
