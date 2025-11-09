import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Clock, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, User } from "lucide-react";
import { useState } from "react";
import { invokeFunctionWithTenant } from "@/lib/supabaseFunctions";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useRoleVisibility } from "@/hooks/useRoleVisibility";

interface Transaction {
  id: string;
  created_at: string;
  reference: string | null;
  type: string;
  direction: string;
  method: string;
  amount: number;
  fee: number;
  net_amount: number;
  status: string;
  counterparty: string | null;
  note: string | null;
  is_verified: boolean;
  verified_at: string | null;
  verified_by: string | null;
  verification_note: string | null;
}

interface TransactionDetailDrawerProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransactionDetailDrawer({ transaction, open, onOpenChange }: TransactionDetailDrawerProps) {
  const [verificationNote, setVerificationNote] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const queryClient = useQueryClient();
  const { isViewer } = useRoleVisibility();

  if (!transaction) return null;

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const { data, error } = await invokeFunctionWithTenant("transaction-verify", {
        transactionId: transaction.id,
        note: verificationNote || null,
      });

      if (error) {
        toast.error("ไม่สามารถยืนยันธุรกรรมได้", {
          description: error.message,
        });
        return;
      }

      toast.success("ยืนยันธุรกรรมสำเร็จ");
      setVerificationNote("");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      onOpenChange(false);
    } catch (error) {
      console.error("Error verifying transaction:", error);
      toast.error("เกิดข้อผิดพลาด", {
        description: "กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config = {
      SUCCESS: { variant: "default" as const, icon: CheckCircle2, color: "text-green-600" },
      PENDING: { variant: "secondary" as const, icon: Clock, color: "text-yellow-600" },
      PROCESSING: { variant: "outline" as const, icon: Clock, color: "text-blue-600" },
      FAILED: { variant: "destructive" as const, icon: XCircle, color: "text-red-600" },
      CANCELED: { variant: "outline" as const, icon: XCircle, color: "text-gray-600" },
    };
    const { variant, icon: Icon, color } = config[status as keyof typeof config] || config.PENDING;
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        <Icon className={`w-3 h-3 ${color}`} />
        {status}
      </Badge>
    );
  };

  const getTypeIcon = (type: string) => {
    if (type === "DEPOSIT") return <ArrowDownToLine className="w-5 h-5 text-green-600" />;
    if (type === "WITHDRAWAL") return <ArrowUpFromLine className="w-5 h-5 text-red-600" />;
    return <ArrowLeftRight className="w-5 h-5 text-blue-600" />;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {getTypeIcon(transaction.type)}
            รายละเอียดธุรกรรม
          </SheetTitle>
          <SheetDescription>
            Reference: <span className="font-mono font-semibold">{transaction.reference || "-"}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status & Verification */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">สถานะ</span>
              {getStatusBadge(transaction.status)}
            </div>
            
            {transaction.is_verified ? (
              <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  ยืนยันแล้ว
                </div>
                {transaction.verified_at && (
                  <p className="text-xs text-muted-foreground">
                    เมื่อ {format(new Date(transaction.verified_at), "dd/MM/yyyy HH:mm")}
                  </p>
                )}
                {transaction.verification_note && (
                  <p className="text-sm text-muted-foreground mt-2">
                    หมายเหตุ: {transaction.verification_note}
                  </p>
                )}
              </div>
            ) : (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400 font-medium">
                  <Clock className="w-4 h-4" />
                  รอการยืนยัน
                </div>
              </div>
            )}
          </div>

          {/* Transaction Details */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold text-base">ข้อมูลธุรกรรม</h3>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">วันที่/เวลา</span>
                <p className="font-mono mt-1">{format(new Date(transaction.created_at), "dd/MM/yyyy HH:mm:ss")}</p>
              </div>
              
              <div>
                <span className="text-muted-foreground">ประเภท</span>
                <p className="font-medium mt-1">{transaction.type}</p>
              </div>
              
              <div>
                <span className="text-muted-foreground">ช่องทาง</span>
                <p className="mt-1">{transaction.method}</p>
              </div>
              
              <div>
                <span className="text-muted-foreground">ทิศทาง</span>
                <p className="mt-1">
                  <Badge variant="outline">{transaction.direction}</Badge>
                </p>
              </div>
            </div>
          </div>

          {/* Amounts */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold text-base">จำนวนเงิน</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">ยอดธุรกรรม</span>
                <span className="font-mono font-semibold text-lg">
                  ฿{transaction.amount.toLocaleString()}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">ค่าธรรมเนียม</span>
                <span className="font-mono text-red-600">-฿{transaction.fee.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center pt-3 border-t">
                <span className="font-medium">ยอดสุทธิ</span>
                <span className={`font-mono font-bold text-xl ${
                  transaction.direction === "IN" ? "text-green-600" : "text-red-600"
                }`}>
                  {transaction.direction === "IN" ? "+" : "-"}฿{transaction.net_amount.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          {(transaction.counterparty || transaction.note) && (
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold text-base">ข้อมูลเพิ่มเติม</h3>
              
              {transaction.counterparty && (
                <div>
                  <span className="text-sm text-muted-foreground">Counterparty</span>
                  <p className="mt-1">{transaction.counterparty}</p>
                </div>
              )}
              
              {transaction.note && (
                <div>
                  <span className="text-sm text-muted-foreground">หมายเหตุ</span>
                  <p className="mt-1 text-sm">{transaction.note}</p>
                </div>
              )}
            </div>
          )}

          {/* Verification Section (Only for viewer role and unverified transactions) */}
          {isViewer && !transaction.is_verified && transaction.status === "SUCCESS" && (
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold text-base">ยืนยันธุรกรรม</h3>
              
              <div className="space-y-2">
                <Label htmlFor="verification-note">หมายเหตุการยืนยัน (ถ้ามี)</Label>
                <Textarea
                  id="verification-note"
                  placeholder="เพิ่มหมายเหตุเกี่ยวกับการยืนยันธุรกรรมนี้..."
                  value={verificationNote}
                  onChange={(e) => setVerificationNote(e.target.value)}
                  rows={3}
                />
              </div>
              
              <Button 
                onClick={handleVerify} 
                disabled={isVerifying}
                className="w-full"
              >
                {isVerifying ? (
                  <>กำลังยืนยัน...</>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    ยืนยันธุรกรรมนี้
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}