import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarIcon, Search, ChevronUp, ChevronDown, Download, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { PaymentDetailsDrawer } from "./PaymentDetailsDrawer";
import { toast } from "sonner";
import { use2FAChallenge } from "@/hooks/use2FAChallenge";
import { TwoFactorChallenge } from "./security/TwoFactorChallenge";

export const PaymentsTable = () => {
  const { activeTenantId } = useTenantSwitcher();
  const { isOpen, setIsOpen, checkAndChallenge, onSuccess } = use2FAChallenge();
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filterExpanded, setFilterExpanded] = useState(true);
  
  const [filters, setFilters] = useState({
    status: "all",
    sortBy: "created_at",
    priority: "all",
    startDate: undefined as Date | undefined,
    endDate: undefined as Date | undefined,
    searchQuery: "",
    accountNumber: "all",
  });

  const { data: payments, isLoading } = useQuery({
    queryKey: ["payments", activeTenantId, filters],
    queryFn: async () => {
      if (!activeTenantId) return [];

      let query = supabase
        .from("payments")
        .select("*")
        .eq("tenant_id", activeTenantId)
        .order(filters.sortBy, { ascending: false });

      if (filters.status !== "all") {
        query = query.eq("status", filters.status);
      }

      if (filters.startDate) {
        query = query.gte("created_at", filters.startDate.toISOString());
      }

      if (filters.endDate) {
        const endOfDay = new Date(filters.endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("created_at", endOfDay.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      
      let filteredData = data || [];
      
      if (filters.searchQuery) {
        filteredData = filteredData.filter(payment => 
          payment.id.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
          payment.provider_payment_id?.toLowerCase().includes(filters.searchQuery.toLowerCase())
        );
      }
      
      return filteredData;
    },
    enabled: !!activeTenantId,
  });

  const statusCounts = {
    all: payments?.length || 0,
    pending: payments?.filter(p => p.status === "pending").length || 0,
    processing: payments?.filter(p => p.status === "processing").length || 0,
    succeeded: payments?.filter(p => p.status === "succeeded").length || 0,
    failed: payments?.filter(p => p.status === "failed").length || 0,
    rejected: payments?.filter(p => p.status === "rejected").length || 0,
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      succeeded: { label: "completed", variant: "default" as const, className: "bg-green-500 hover:bg-green-600 text-white" },
      pending: { label: "pending", variant: "secondary" as const, className: "" },
      processing: { label: "processing", variant: "default" as const, className: "bg-blue-500 hover:bg-blue-600 text-white" },
      failed: { label: "failed", variant: "destructive" as const, className: "" },
      rejected: { label: "rejected", variant: "destructive" as const, className: "" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { 
      label: status, 
      variant: "secondary" as const,
      className: ""
    };

    return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
  };

  const exportToCSV = async () => {
    if (!payments || payments.length === 0) {
      toast.error("No data to export");
      return;
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      tenant_id: activeTenantId,
      action: 'payments.export.csv',
      target: 'payments',
      after: { count: payments.length }
    });

    const headers = ["Date", "Ref ID", "TX ID", "Amount", "Currency", "Status", "Method", "Provider"];
    const csvData = payments.map(payment => [
      format(new Date(payment.created_at), "yyyy-MM-dd HH:mm:ss"),
      payment.provider_payment_id || "",
      payment.id,
      (payment.amount / 100).toString(),
      payment.currency,
      payment.status,
      payment.method || "",
      payment.provider || ""
    ]);

    const csvContent = [
      headers.join(","),
      ...csvData.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `payments_${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Data exported successfully");
  };

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={() => checkAndChallenge(exportToCSV)}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={filters.status === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilters({ ...filters, status: "all" })}
        >
          All {statusCounts.all > 0 && <Badge variant="secondary" className="ml-2 bg-red-500 hover:bg-red-600 text-white">{statusCounts.all}</Badge>}
        </Button>
        <Button
          variant={filters.status === "pending" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilters({ ...filters, status: "pending" })}
        >
          Pending
        </Button>
        <Button
          variant={filters.status === "processing" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilters({ ...filters, status: "processing" })}
        >
          Processing
        </Button>
        <Button
          variant={filters.status === "succeeded" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilters({ ...filters, status: "succeeded" })}
        >
          Complete {statusCounts.succeeded > 0 && <Badge variant="secondary" className="ml-2 bg-red-500 hover:bg-red-600 text-white">{statusCounts.succeeded}</Badge>}
        </Button>
        <Button
          variant={filters.status === "failed" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilters({ ...filters, status: "failed" })}
        >
          Failed {statusCounts.failed > 0 && <Badge variant="secondary" className="ml-2 bg-red-500 hover:bg-red-600 text-white">{statusCounts.failed}</Badge>}
        </Button>
        <Button
          variant={filters.status === "rejected" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilters({ ...filters, status: "rejected" })}
        >
          Rejected
        </Button>
      </div>

      {/* Filter Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilterExpanded(!filterExpanded)}
                className="flex items-center gap-2"
              >
                {filterExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Filter
              </Button>
            </div>

            {filterExpanded && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Sort By</label>
                    <Select 
                      value={filters.sortBy} 
                      onValueChange={(value) => setFilters({ ...filters, sortBy: value })}
                    >
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
                    <Select 
                      value={filters.priority} 
                      onValueChange={(value) => setFilters({ ...filters, priority: value })}
                    >
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
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !filters.startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {filters.startDate ? format(filters.startDate, "dd/MM/yyyy") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={filters.startDate}
                          onSelect={(date) => setFilters({ ...filters, startDate: date })}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">End Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !filters.endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {filters.endDate ? format(filters.endDate, "dd/MM/yyyy") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={filters.endDate}
                          onSelect={(date) => setFilters({ ...filters, endDate: date })}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="input search text..."
                    value={filters.searchQuery}
                    onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Create At</TableHead>
                  <TableHead>Ref ID</TableHead>
                  <TableHead>TX ID</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Acc Num</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sys Bank</TableHead>
                  <TableHead>Ops Type</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : payments && payments.length > 0 ? (
                  payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="text-sm">
                        {format(new Date(payment.created_at), "yyyy-MM-dd HH:mm:ss")}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {payment.provider_payment_id?.slice(0, 12) || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-primary">
                        {payment.id.slice(0, 12)}
                      </TableCell>
                      <TableCell>no13</TableCell>
                      <TableCell>no13</TableCell>
                      <TableCell>no13</TableCell>
                      <TableCell className="font-semibold">
                        {(payment.amount / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="default" className="bg-blue-500 hover:bg-blue-600 text-white">
                          BI
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {(payment.metadata as any)?.account_number || "2784106235"}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(payment.status)}
                      </TableCell>
                      <TableCell>BITPAYZ</TableCell>
                      <TableCell>
                        <Badge variant="outline">MANUAL_SETTLEMENT</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => {
                            setSelectedPayment(payment);
                            setDrawerOpen(true);
                          }}
                        >
                          Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                      No payments found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <PaymentDetailsDrawer
        payment={selectedPayment}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedPayment(null);
        }}
      />
      <TwoFactorChallenge open={isOpen} onOpenChange={setIsOpen} onSuccess={onSuccess} />
    </div>
  );
};