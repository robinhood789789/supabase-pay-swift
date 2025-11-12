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
  txn_time: string;
  to_account: string;
  to_name: string;
  trans_name_th: string;
  amount: number;
  slip_bank_from: string;
  from_account: string;
  from_name: string;
  bank_code: string;
  ref_id: string;
  adminbank_id: string;
  status: string;
}

const IncomingTransactions = () => {
  const today = format(new Date(), "yyyy-MM-dd");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["incoming-transactions", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incoming_transfers" as any)
        .select("*")
        .gte("txn_time", `${startDate}T00:00:00`)
        .lte("txn_time", `${endDate}T23:59:59`)
        .order("txn_time", { ascending: false });

      if (error) throw error;

      return (data || []) as unknown as IncomingTransaction[];
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-full overflow-hidden bg-white min-h-screen">
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-medium text-black tracking-tight">ข้อมูลการแจ้งฝากเงิน</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded p-6">
        <h2 className="text-lg font-medium text-black mb-6 tracking-tight">รายการเงินเข้า</h2>
        
        <div className="flex flex-col sm:flex-row gap-3 items-end mb-6">
          <div className="flex-1 min-w-0">
            <Label className="text-xs font-medium text-gray-700 uppercase tracking-wider">วันที่</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border-gray-300 bg-white text-black"
            />
          </div>
          <div className="flex-1 min-w-0">
            <Label className="text-xs font-medium text-gray-700 uppercase tracking-wider">ถึง</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border-gray-300 bg-white text-black"
            />
          </div>
          <Button className="bg-black text-white hover:bg-gray-800 whitespace-nowrap border-0">
            ค้นหา
          </Button>
        </div>

        <div className="border border-gray-200 rounded overflow-x-auto">
          <Table className="min-w-full">
            <TableHeader className="bg-gray-50 border-b border-gray-200">
              <TableRow className="hover:bg-gray-50">
                <TableHead className="text-black font-semibold text-xs uppercase tracking-wider">วันที่/เวลารายการ</TableHead>
                <TableHead className="text-black font-semibold text-xs uppercase tracking-wider">บัญชีรับ</TableHead>
                <TableHead className="text-black font-semibold text-xs uppercase tracking-wider">รายการ</TableHead>
                <TableHead className="text-black font-semibold text-xs text-right uppercase tracking-wider">ฝาก (บาท)</TableHead>
                <TableHead className="text-black font-semibold text-xs uppercase tracking-wider">รายละเอียด</TableHead>
                <TableHead className="text-black font-semibold text-xs uppercase tracking-wider">ช่องทาง</TableHead>
                <TableHead className="text-black font-semibold text-xs uppercase tracking-wider">รหัสผู้ฝากเงิน</TableHead>
                <TableHead className="text-black font-semibold text-xs uppercase tracking-wider">สถานะ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-gray-500">
                    กำลังโหลด...
                  </TableCell>
                </TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-gray-500">
                    ไม่พบข้อมูล
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((transaction) => (
                  <TableRow key={transaction.id} className="text-sm border-b border-gray-100 hover:bg-gray-50">
                    <TableCell className="text-xs text-gray-700 whitespace-nowrap">
                      {transaction.txn_time ? format(new Date(transaction.txn_time), "dd-MMM-yyyy HH:mm") : "-"}
                    </TableCell>
                    <TableCell className="text-xs text-black">
                      {transaction.to_account ? `${transaction.to_account}${transaction.to_name ? ` (${transaction.to_name})` : ""}` : "-"}
                    </TableCell>
                    <TableCell className="text-xs text-gray-700">{transaction.trans_name_th || "รับโอนเงิน"}</TableCell>
                    <TableCell className="text-xs text-right font-mono text-black font-medium">
                      {transaction.amount ? Number(transaction.amount).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }) : "0.00"}
                    </TableCell>
                    <TableCell className="text-xs text-gray-700">
                      {transaction.from_account ? `${transaction.slip_bank_from || ""} ${transaction.from_account}${transaction.from_name ? ` (${transaction.from_name})` : ""}` : "-"}
                    </TableCell>
                    <TableCell className="text-xs font-medium text-black">{transaction.bank_code || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="bg-white text-black border-gray-300 text-xs font-mono"
                      >
                        {transaction.ref_id || transaction.adminbank_id || "-"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {transaction.status === "success" || transaction.status === "completed" ? (
                        <Badge className="bg-black text-white hover:bg-gray-800 text-xs border-0">
                          สำเร็จ
                        </Badge>
                      ) : transaction.status === "failed" ? (
                        <Badge className="bg-gray-200 text-black hover:bg-gray-300 text-xs border border-gray-300">
                          ล้มเหลว
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs border-gray-300 text-gray-700">
                          {transaction.status || "รอดำเนินการ"}
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
