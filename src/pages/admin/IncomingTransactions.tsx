import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface IncomingTransaction {
  id: string;
  created_at: string;
  account_type: string;
  transaction_type: string;
  amount: number;
  account_details: string;
  channel: string;
  depositor_code: string;
  status: "success" | "pending" | "failed";
}

const IncomingTransactions = () => {
  const today = format(new Date(), "yyyy-MM-dd");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["incoming-transactions", startDate, endDate],
    queryFn: async () => {
      // ดึงข้อมูลจากตาราง payments ที่เป็นประเภท deposit และมี status = paid_at
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("type", "deposit")
        .gte("created_at", `${startDate}T00:00:00`)
        .lte("created_at", `${endDate}T23:59:59`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // แปลงข้อมูลให้ตรงกับรูปแบบที่ต้องการ
      return (data || []).map((payment) => ({
        id: payment.id,
        created_at: payment.created_at,
        account_type: payment.bank_name || "",
        transaction_type: "รับโอนเงิน",
        amount: payment.amount / 100, // แปลงจาก satoshi เป็น บาท
        account_details: `${payment.bank_account_number || ""} - ${payment.provider || ""}`,
        channel: payment.provider || "SCB",
        depositor_code: payment.provider_payment_id || `T-${payment.id.substring(0, 13)}`,
        status: payment.status === "succeeded" ? "success" : payment.status === "pending" ? "pending" : "failed",
      })) as IncomingTransaction[];
    },
  });

  return (
    <div className="p-4 space-y-4 max-w-full overflow-hidden">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">ข้อมูลการแจ้งฝากเงิน</h1>
      </div>

      <div className="bg-card border rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-4">รายการเงินเข้า</h2>
        
        <div className="flex flex-col sm:flex-row gap-3 items-end mb-4">
          <div className="flex-1 min-w-0">
            <Label className="text-sm">วันที่</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex-1 min-w-0">
            <Label className="text-sm">ถึง</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <Button className="bg-green-600 hover:bg-green-700 whitespace-nowrap">
            ค้นหา
          </Button>
        </div>

        <div className="border rounded-lg overflow-x-auto">
          <Table className="min-w-full">
            <TableHeader className="bg-destructive">
              <TableRow className="hover:bg-destructive/90">
                <TableHead className="text-destructive-foreground font-bold text-xs">วันที่/เวลารายการ</TableHead>
                <TableHead className="text-destructive-foreground font-bold text-xs">บัญชีรับ</TableHead>
                <TableHead className="text-destructive-foreground font-bold text-xs">รายการ</TableHead>
                <TableHead className="text-destructive-foreground font-bold text-xs text-right">ฝาก (บาท)</TableHead>
                <TableHead className="text-destructive-foreground font-bold text-xs">รายละเอียด</TableHead>
                <TableHead className="text-destructive-foreground font-bold text-xs">ช่องทาง</TableHead>
                <TableHead className="text-destructive-foreground font-bold text-xs">รหัสผู้ฝากเงิน</TableHead>
                <TableHead className="text-destructive-foreground font-bold text-xs">สถานะ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm">
                    กำลังโหลด...
                  </TableCell>
                </TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm">
                    ไม่พบข้อมูล
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((transaction) => (
                  <TableRow key={transaction.id} className="text-sm">
                    <TableCell className="text-xs whitespace-nowrap">
                      {format(new Date(transaction.created_at), "dd-MMM-yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-xs">{transaction.account_type || "-"}</TableCell>
                    <TableCell className="text-xs">{transaction.transaction_type}</TableCell>
                    <TableCell className="text-xs text-right font-mono">
                      {transaction.amount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-xs">{transaction.account_details}</TableCell>
                    <TableCell className="text-xs font-semibold">{transaction.channel}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="bg-green-50 text-green-700 border-green-300 text-xs font-mono"
                      >
                        {transaction.depositor_code}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {transaction.status === "success" ? (
                        <Badge className="bg-green-600 hover:bg-green-700 text-xs">
                          ปรับเครดิตสำเร็จ
                        </Badge>
                      ) : transaction.status === "failed" ? (
                        <Badge className="bg-cyan-500 hover:bg-cyan-600 text-xs">
                          ปรับเครดิตไม่สำเร็จ
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          รอดำเนินการ
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default IncomingTransactions;
