import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useShareholder } from "@/hooks/useShareholder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { ArrowUpDown, Download } from "lucide-react";

type Transaction = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  created_at: string;
  paid_at: string | null;
  tenant_id: string;
  tenants: {
    id: string;
    name: string;
    public_id: string;
  };
  commission_rate: number;
  commission_amount: number;
};

async function fetchTransactions(limit = 50, offset = 0) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const response = await supabase.functions.invoke('shareholder-client-transactions', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: { limit, offset },
  });

  if (response.error) throw response.error;
  return response.data.data;
}

export default function ShareholderTransactions() {
  const { shareholder } = useShareholder();
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["shareholder-transactions", shareholder?.id, page],
    queryFn: () => fetchTransactions(pageSize, page * pageSize),
    enabled: !!shareholder?.id,
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      succeeded: "default",
      pending: "secondary",
      failed: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
      </div>
    );
  }

  const transactions: Transaction[] = data?.transactions || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  const totalCommission = transactions.reduce((sum, t) => 
    t.status === 'succeeded' ? sum + t.commission_amount : sum, 0
  );

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
            💰 ธุรกรรมของลูกค้า
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
            ดูธุรกรรมและค่าคอมมิชชั่นที่ได้รับ
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          ส่งออก
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ธุรกรรมทั้งหมด
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ธุรกรรมในหน้านี้
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transactions.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ค่าคอมฯ ในหน้านี้
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCommission)}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-soft border border-border">
        <CardHeader>
          <CardTitle>ประวัติธุรกรรม</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่</TableHead>
                  <TableHead>ลูกค้า</TableHead>
                  <TableHead className="text-right">จำนวนเงิน</TableHead>
                  <TableHead>วิธีชำระ</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">% คอมฯ</TableHead>
                  <TableHead className="text-right">ค่าคอมฯ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      ไม่พบธุรกรรม
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(transaction.created_at), "dd MMM yyyy HH:mm", { locale: th })}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{transaction.tenants.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {transaction.tenants.public_id}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(transaction.amount / 100)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{transaction.method || "-"}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                      <TableCell className="text-right">
                        {transaction.commission_rate.toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {transaction.status === 'succeeded' 
                          ? formatCurrency(transaction.commission_amount)
                          : "-"
                        }
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                หน้า {page + 1} จาก {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                >
                  ก่อนหน้า
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                >
                  ถัดไป
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
