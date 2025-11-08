import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface EditOwnerDialogProps {
  owner: {
    ownerId: string;
    businessName: string;
    publicId: string;
    email?: string;
    status?: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditOwnerDialog({ owner, open, onOpenChange, onSuccess }: EditOwnerDialogProps) {
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("active");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (owner) {
      setBusinessName(owner.businessName || "");
      setEmail(owner.email || "");
      setStatus(owner.status?.toLowerCase() || "active");
    }
  }, [owner]);

  const handleSubmit = async () => {
    if (!owner) return;

    if (!businessName.trim()) {
      toast.error("กรุณากรอกชื่อธุรกิจ");
      return;
    }

    try {
      setLoading(true);

      // Update tenant status
      const { error: tenantError } = await supabase
        .from("tenants")
        .update({ 
          name: businessName,
          status: status 
        })
        .eq("id", owner.ownerId);

      if (tenantError) throw tenantError;

      // Also update shareholder_clients status to keep them in sync
      const { error: shareholderClientError } = await supabase
        .from("shareholder_clients")
        .update({ status: status })
        .eq("tenant_id", owner.ownerId);

      if (shareholderClientError) throw shareholderClientError;

      toast.success("อัปเดทข้อมูลสำเร็จ");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating owner:", error);
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!owner) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>แก้ไขข้อมูล Owner</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Public ID</Label>
            <Input
              value={owner.publicId}
              disabled
              className="font-mono bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label>ชื่อธุรกิจ *</Label>
            <Input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="บริษัท ABC จำกัด"
            />
          </div>

          <div className="space-y-2">
            <Label>สถานะ *</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    Active (ใช้งาน)
                  </div>
                </SelectItem>
                <SelectItem value="inactive">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-gray-500" />
                    Inactive (ไม่ใช้งาน)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              เปลี่ยนสถานะการใช้งานของบัญชี Owner
            </p>
          </div>

          <div className="space-y-2">
            <Label>อีเมล</Label>
            <Input
              type="email"
              value={email}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              อีเมลไม่สามารถแก้ไขได้ในขณะนี้
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                "บันทึกการเปลี่ยนแปลง"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
