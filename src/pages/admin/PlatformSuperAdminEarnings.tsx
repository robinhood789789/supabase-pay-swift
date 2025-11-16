import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Download, TrendingUp, Wallet, Percent } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

type DateRange = "7d" | "30d" | "90d" | "all";

export default function PlatformSuperAdminEarnings() {
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [useMockData, setUseMockData] = useState(false);

  const getDateRange = () => {
    const end = new Date();
    const start = new Date();
    
    switch (dateRange) {
      case "7d":
        start.setDate(end.getDate() - 7);
        break;
      case "30d":
        start.setDate(end.getDate() - 30);
        break;
      case "90d":
        start.setDate(end.getDate() - 90);
        break;
      case "all":
        start.setFullYear(2020, 0, 1);
        break;
    }
    
    return { start: start.toISOString(), end: end.toISOString() };
  };

  const { start, end } = getDateRange();

  // Fetch incoming transfers data
  const { data: transfersData, isLoading: transfersLoading } = useQuery({
    queryKey: ["super-admin-transfers", start, end, useMockData],
    queryFn: async () => {
      if (useMockData) {
        return mockTransfersData;
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
  });

  // Calculate commissions (5% average commission rate)
  const AVERAGE_COMMISSION_RATE = 0.05;
  
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

    return {
      totalRevenue,
      totalCommissions,
      netEarnings,
      commissionRate,
      transferCount: transfersData?.length || 0,
    };
  };

  const metrics = calculateMetrics();

  const handleExportCSV = () => {
    const headers = ["Date", "Transfer ID", "Amount", "Commission Paid", "Net Amount"];
    const rows = transfersData?.map((transfer) => {
      const commission = commissionsData.find(c => c.transfer_id === transfer.id);
      const commissionAmount = commission?.commission_amount || 0;
      const netAmount = Number(transfer.amount || 0) - commissionAmount;
      
      return [
        format(new Date(transfer.created_at || ""), "yyyy-MM-dd HH:mm"),
        transfer.id,
        Number(transfer.amount || 0),
        commissionAmount,
        netAmount,
      ].join(",");
    }) || [];

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `super-admin-earnings-${format(new Date(), "yyyy-MM-dd")}.csv`;
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

      <Tabs value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
        <TabsList>
          <TabsTrigger value="7d">
            <Calendar className="w-4 h-4 mr-2" />
            Last 7 Days
          </TabsTrigger>
          <TabsTrigger value="30d">Last 30 Days</TabsTrigger>
          <TabsTrigger value="90d">Last 90 Days</TabsTrigger>
          <TabsTrigger value="all">All Time</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            <CardTitle className="text-sm font-medium">Commissions Paid</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalCommissions)}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.commissionRate.toFixed(2)}% of revenue
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
            <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(100 - metrics.commissionRate).toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Net retention rate
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transfer Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Transfer ID</TableHead>
                <TableHead>From Account</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Net Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : transfersData && transfersData.length > 0 ? (
                transfersData.slice(0, 50).map((transfer) => {
                  const commission = commissionsData.find(c => c.transfer_id === transfer.id);
                  const commissionAmount = commission?.commission_amount || 0;
                  const netAmount = Number(transfer.amount || 0) - commissionAmount;

                  return (
                    <TableRow key={transfer.id}>
                      <TableCell>
                        {format(new Date(transfer.created_at || ""), "MMM dd, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{transfer.id.slice(0, 8)}</TableCell>
                      <TableCell>{transfer.from_account || "-"}</TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(Number(transfer.amount || 0))}
                      </TableCell>
                      <TableCell className="text-orange-600">
                        {formatCurrency(commissionAmount)}
                      </TableCell>
                      <TableCell className="font-bold text-primary">
                        {formatCurrency(netAmount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={transfer.status === "completed" ? "default" : "secondary"}>
                          {transfer.status || "pending"}
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
        </CardContent>
      </Card>
    </div>
  );
}

// Mock data
const mockTransfersData = [
  {
    id: "txn_001",
    amount: 500000,
    from_account: "1234567890",
    from_name: "Client A",
    status: "completed",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: "txn_002",
    amount: 750000,
    from_account: "0987654321",
    from_name: "Client B",
    status: "completed",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
  {
    id: "txn_003",
    amount: 1000000,
    from_account: "1122334455",
    from_name: "Client C",
    status: "completed",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
  },
  {
    id: "txn_004",
    amount: 250000,
    from_account: "5544332211",
    from_name: "Client D",
    status: "completed",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
  },
  {
    id: "txn_005",
    amount: 600000,
    from_account: "6677889900",
    from_name: "Client E",
    status: "completed",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
  },
];

