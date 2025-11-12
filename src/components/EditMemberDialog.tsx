import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Eye, Code, Users } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface EditMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: {
    id: string;
    full_name: string;
    email: string;
    status: string;
    tenant_id: string;
    role?: string;
    role_id?: string;
  } | null;
}

export function EditMemberDialog({ open, onOpenChange, member }: EditMemberDialogProps) {
  const [status, setStatus] = useState<string>(member?.status || "active");
  const [selectedRole, setSelectedRole] = useState<string>(member?.role || "");
  const queryClient = useQueryClient();

  // Fetch available roles
  const { data: roles = [] } = useQuery<any[]>({
    queryKey: ["roles-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roles")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data as any[];
    },
    enabled: open,
  });

  // Update status and role whenever member changes
  useEffect(() => {
    if (member) {
      setStatus(member.status);
      setSelectedRole(member.role || "");
    }
  }, [member]);

  const updateMemberMutation = useMutation({
    mutationFn: async ({ 
      userId, 
      tenantId, 
      newRole,
      newStatus 
    }: { 
      userId: string; 
      tenantId: string; 
      newRole?: string;
      newStatus?: string;
    }) => {
      const updates: any = {};
      
      // If role changed, get the role_id
      if (newRole && newRole !== member?.role) {
        const { data: roleData, error: roleError } = await supabase
          .from("roles")
          .select("id")
          .eq("name", newRole)
          .single();

        if (roleError) throw roleError;
        if (!roleData) throw new Error(`Role ${newRole} not found`);
        
        updates.role_id = roleData.id;
      }
      
      // If status changed, add it to updates
      if (newStatus && newStatus !== member?.status) {
        updates.status = newStatus;
      }
      
      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from("memberships")
          .update(updates)
          .eq("user_id", userId)
          .eq("tenant_id", tenantId);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("อัพเดทข้อมูลสำเร็จ!");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error("เกิดข้อผิดพลาด", {
        description: error.message,
      });
    },
  });

  const handleSubmit = () => {
    if (!member) return;
    
    updateMemberMutation.mutate({
      userId: member.id,
      tenantId: member.tenant_id,
      newRole: selectedRole,
      newStatus: status,
    });
  };

  const getRoleIcon = (roleName: string) => {
    switch (roleName) {
      case "manager":
        return <Users className="w-4 h-4 text-purple-600" />;
      case "finance":
        return <ShieldCheck className="w-4 h-4 text-blue-600" />;
      case "developer":
        return <Code className="w-4 h-4 text-cyan-600" />;
      case "viewer":
        return <Eye className="w-4 h-4 text-gray-600" />;
      default:
        return null;
    }
  };

  const getRoleDescription = (roleName: string) => {
    switch (roleName) {
      case "manager":
        return "จัดการระบบและผู้ใช้ทั้งหมด";
      case "finance":
        return "จัดการการเงินและรายงาน";
      case "developer":
        return "เข้าถึง API และพัฒนาระบบ";
      case "viewer":
        return "ดูข้อมูลเท่านั้น ไม่สามารถแก้ไข";
      default:
        return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>แก้ไขสถานะสมาชิก</DialogTitle>
          <DialogDescription>
            แก้ไขสถานะของ {member?.full_name || member?.email}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>อีเมล</Label>
            <div className="text-sm text-muted-foreground">{member?.email}</div>
          </div>

          <div className="space-y-2">
            <Label>Public ID</Label>
            <div className="text-sm text-muted-foreground font-mono">{(member as any)?.public_id || "-"}</div>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label>บทบาท (Role)</Label>
            <RadioGroup value={selectedRole} onValueChange={setSelectedRole}>
              {roles.map((role) => (
                <div key={role.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={role.name} id={role.name} />
                  <Label htmlFor={role.name} className="font-normal cursor-pointer flex-1">
                    <div className="flex items-center gap-2">
                      {getRoleIcon(role.name)}
                      <div>
                        <div className="font-medium">{role.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {getRoleDescription(role.name)}
                        </div>
                      </div>
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label>สถานะ</Label>
            <RadioGroup value={status} onValueChange={setStatus}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="active" id="active" />
                <Label htmlFor="active" className="font-normal cursor-pointer">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    Active - สามารถเข้าใช้งานได้
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="inactive" id="inactive" />
                <Label htmlFor="inactive" className="font-normal cursor-pointer">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    Inactive - ไม่สามารถเข้าใช้งานได้
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button onClick={handleSubmit} disabled={updateMemberMutation.isPending}>
            {updateMemberMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
