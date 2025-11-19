import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface EditCommissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  tenantName: string;
  currentRate: number;
  shareholderId: string;
}

export function EditCommissionDialog({
  open,
  onOpenChange,
  tenantId,
  tenantName,
  currentRate,
  shareholderId,
}: EditCommissionDialogProps) {
  const [rate, setRate] = useState(currentRate.toString());
  const queryClient = useQueryClient();

  const updateCommissionMutation = useMutation({
    mutationFn: async (newRate: number) => {
      const { error } = await supabase
        .from("shareholder_clients")
        .update({ commission_rate: newRate })
        .eq("shareholder_id", shareholderId)
        .eq("tenant_id", tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("อัปเดตเปอร์เซนต์ส่วนแบ่งสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["shareholder-mdr"] });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error updating commission:", error);
      toast.error("เกิดข้อผิดพลาดในการอัปเดตเปอร์เซนต์ส่วนแบ่ง");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newRate = parseFloat(rate);

    if (isNaN(newRate) || newRate < 0 || newRate > 100) {
      toast.error("กรุณาใส่เปอร์เซนต์ที่ถูกต้อง (0-100)");
      return;
    }

    updateCommissionMutation.mutate(newRate);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>แก้ไขเปอร์เซนต์ส่วนแบ่ง Shareholder</DialogTitle>
            <DialogDescription>
              แก้ไขเปอร์เซนต์ส่วนแบ่งสำหรับลูกค้า: <strong>{tenantName}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="commission-rate">
                เปอร์เซนต์ส่วนแบ่ง (%)
              </Label>
              <Input
                id="commission-rate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="เช่น 5.00"
                disabled={updateCommissionMutation.isPending}
              />
              <p className="text-sm text-muted-foreground">
                เปอร์เซนต์ปัจจุบัน: {currentRate.toFixed(2)}%
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateCommissionMutation.isPending}
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              disabled={updateCommissionMutation.isPending}
            >
              {updateCommissionMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              บันทึก
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
