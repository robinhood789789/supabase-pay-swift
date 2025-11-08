import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";
import DashboardLayout from "@/components/DashboardLayout";
import ReconciliationUpload from "@/components/reconciliation/ReconciliationUpload";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PermissionGate } from "@/components/PermissionGate";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileCheck, TrendingUp, AlertTriangle } from "lucide-react";

export default function Reconciliation() {
  const { activeTenantId } = useTenantSwitcher();

  const { data: payments, isLoading } = useQuery({
    queryKey: ["reconciliation-payments", activeTenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("tenant_id", activeTenantId!)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    enabled: !!activeTenantId,
  });

  const matchedCount = payments?.filter((p) => p.reconciliation_status === "matched").length || 0;
  const unmatchedCount = payments?.filter((p) => p.reconciliation_status === "unmatched").length || 0;
  const totalCount = payments?.length || 0;
  const matchRate = totalCount > 0 ? ((matchedCount / totalCount) * 100).toFixed(1) : "0";

  const getStatusColor = (status: string) => {
    switch (status) {
      case "matched":
        return "bg-green-500/10 text-green-500";
      case "unmatched":
        return "bg-yellow-500/10 text-yellow-500";
      case "disputed":
        return "bg-red-500/10 text-red-500";
      default:
        return "bg-gray-500/10 text-gray-500";
    }
  };

  return (
    <DashboardLayout>
      <PermissionGate
        permissions={["reconciliation.manage", "reconciliation.view"]}
        requireAll={false}
        fallback={
          <div className="p-6">
            <div className="text-center p-8 border rounded-lg">
              <p className="text-muted-foreground">
                คุณไม่มีสิทธิ์เข้าถึงหน้านี้
              </p>
            </div>
          </div>
        }
      >
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileCheck className="h-8 w-8" />
            Reconciliation
          </h1>
          <p className="text-muted-foreground">
            Match and reconcile payment transactions with bank statements
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Match Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{matchRate}%</div>
              <p className="text-xs text-muted-foreground">
                {matchedCount} of {totalCount} transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Matched</CardTitle>
              <FileCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{matchedCount}</div>
              <p className="text-xs text-muted-foreground">Successfully reconciled</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unmatched</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{unmatchedCount}</div>
              <p className="text-xs text-muted-foreground">Requires attention</p>
            </CardContent>
          </Card>
        </div>

        <ReconciliationUpload />

        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>
              View reconciliation status of recent payments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reconciliation</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : payments?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        No transactions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments?.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-mono text-sm">
                          {payment.provider_payment_id?.substring(0, 16)}...
                        </TableCell>
                        <TableCell>
                          {payment.currency} {(payment.amount / 100).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{payment.provider}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              payment.status === "succeeded" ? "default" : "secondary"
                            }
                          >
                            {payment.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={getStatusColor(
                              payment.reconciliation_status || "unmatched"
                            )}
                          >
                            {payment.reconciliation_status || "unmatched"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(payment.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
      </PermissionGate>
    </DashboardLayout>
  );
}
