import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { Loader2 } from "lucide-react";

interface ClientTransferDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  tenantName: string;
  ownerName: string;
  startDate: Date;
  endDate: Date;
}

interface DailyTransfer {
  date: string;
  deposits: number;
  topups: number;
  settlements: number;
  total: number;
}

export function ClientTransferDetailsDrawer({
  open,
  onOpenChange,
  tenantId,
  tenantName,
  ownerName,
  startDate,
  endDate,
}: ClientTransferDetailsDrawerProps) {
  const { data: dailyData, isLoading } = useQuery<DailyTransfer[]>({
    queryKey: ["client-daily-transfers", tenantId, format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd")],
    queryFn: async () => {
      const startDateStr = format(startDate, "yyyy-MM-dd");
      const endDateStr = format(endDate, "yyyy-MM-dd");

      // Fetch deposit_transfers
      const { data: deposits } = await supabase
        .from("deposit_transfers")
        .select("depositdate, amountpaid")
        .gte("depositdate", startDateStr)
        .lte("depositdate", endDateStr);

      // Fetch topup_transfers
      const { data: topups } = await supabase
        .from("topup_transfers")
        .select("transfer_date, amount")
        .gte("transfer_date", startDateStr)
        .lte("transfer_date", endDateStr);

      // Fetch settlement_transfers
      const { data: settlements } = await supabase
        .from("settlement_transfers")
        .select("created_at, amount")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr);

      // Group by date
      const dateMap = new Map<string, DailyTransfer>();

      deposits?.forEach((d) => {
        const date = format(new Date(d.depositdate || ""), "yyyy-MM-dd");
        const existing = dateMap.get(date) || { date, deposits: 0, topups: 0, settlements: 0, total: 0 };
        existing.deposits += Number(d.amountpaid) || 0;
        existing.total += Number(d.amountpaid) || 0;
        dateMap.set(date, existing);
      });

      topups?.forEach((t) => {
        const date = format(new Date(t.transfer_date || ""), "yyyy-MM-dd");
        const existing = dateMap.get(date) || { date, deposits: 0, topups: 0, settlements: 0, total: 0 };
        existing.topups += Number(t.amount) || 0;
        existing.total += Number(t.amount) || 0;
        dateMap.set(date, existing);
      });

      settlements?.forEach((s) => {
        const date = format(new Date(s.created_at || ""), "yyyy-MM-dd");
        const existing = dateMap.get(date) || { date, deposits: 0, topups: 0, settlements: 0, total: 0 };
        existing.settlements += Number(s.amount) || 0;
        existing.total += Number(s.amount) || 0;
        dateMap.set(date, existing);
      });

      // Convert to array and sort by date
      return Array.from(dateMap.values()).sort((a, b) => b.date.localeCompare(a.date));
    },
    enabled: open && !!tenantId,
  });

  const totalSummary = dailyData?.reduce(
    (acc, curr) => ({
      deposits: acc.deposits + curr.deposits,
      topups: acc.topups + curr.topups,
      settlements: acc.settlements + curr.settlements,
      total: acc.total + curr.total,
    }),
    { deposits: 0, topups: 0, settlements: 0, total: 0 }
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>รายละเอียดความเคลื่อนไหวรายวัน</DrawerTitle>
          <DrawerDescription>
            <div className="flex flex-col gap-1 mt-2">
              <span className="font-medium text-foreground">Public ID: {tenantName}</span>
              <span className="font-medium text-foreground">ชื่อ: {ownerName}</span>
              <span className="text-sm text-muted-foreground">
                ช่วงเวลา: {format(startDate, "dd MMM yyyy", { locale: th })} - {format(endDate, "dd MMM yyyy", { locale: th })}
              </span>
            </div>
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-4 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Deposits</div>
                  <div className="text-xl font-bold text-foreground">{formatCurrency(totalSummary?.deposits || 0)}</div>
                </div>
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Top-ups</div>
                  <div className="text-xl font-bold text-foreground">{formatCurrency(totalSummary?.topups || 0)}</div>
                </div>
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Settlements</div>
                  <div className="text-xl font-bold text-foreground">{formatCurrency(totalSummary?.settlements || 0)}</div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
                  <div className="text-sm text-emerald-700 dark:text-emerald-400 mb-1">ยอดรวม</div>
                  <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(totalSummary?.total || 0)}</div>
                </div>
              </div>

              {/* Daily Table */}
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="font-semibold">วันที่</TableHead>
                      <TableHead className="text-right font-semibold">Deposits</TableHead>
                      <TableHead className="text-right font-semibold">Top-ups</TableHead>
                      <TableHead className="text-right font-semibold">Settlements</TableHead>
                      <TableHead className="text-right font-semibold text-emerald-700 dark:text-emerald-400">ยอดรวมต่อวัน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!dailyData || dailyData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          ไม่พบข้อมูลในช่วงเวลานี้
                        </TableCell>
                      </TableRow>
                    ) : (
                      dailyData.map((row) => (
                        <TableRow key={row.date} className="hover:bg-muted/50">
                          <TableCell className="font-medium">
                            {format(new Date(row.date), "dd MMM yyyy", { locale: th })}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(row.deposits)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.topups)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.settlements)}</TableCell>
                          <TableCell className="text-right font-bold text-emerald-700 dark:text-emerald-400">
                            {formatCurrency(row.total)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
