import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface BankAccount {
  id: string;
  bank_code: string;
  bank_short_name: string;
  bank_name: string;
  account_holder: string | null;
  account_number: string;
  notes: string | null;
  password_visible: boolean;
  deposit_enabled: boolean;
  withdrawal_enabled: boolean;
  status: "online" | "offline";
  created_at: string;
  updated_at: string;
}

interface BankAccountFormData {
  bank_code: string;
  bank_short_name: string;
  bank_name: string;
  account_holder: string;
  account_number: string;
  notes: string;
  password_visible: boolean;
  deposit_enabled: boolean;
  withdrawal_enabled: boolean;
  status: "online" | "offline";
}

const BANK_LOGOS: Record<string, string> = {
  GSB: "🏦",
  KBANK: "🟢",
  KTB: "🔵",
  TTB: "🔴",
  SCB: "💜",
  BBL: "🟣",
};

const CustomerBankAccounts = () => {
  const [codeFilter, setCodeFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [deleteAccount, setDeleteAccount] = useState<BankAccount | null>(null);
  const [formData, setFormData] = useState<BankAccountFormData>({
    bank_code: "",
    bank_short_name: "",
    bank_name: "",
    account_holder: "",
    account_number: "",
    notes: "",
    password_visible: false,
    deposit_enabled: true,
    withdrawal_enabled: true,
    status: "offline",
  });

  const queryClient = useQueryClient();

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["customer-bank-accounts", codeFilter, searchFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("customer_bank_accounts")
        .select("*")
        .order("created_at", { ascending: false });

      if (codeFilter) {
        query = query.ilike("bank_code", `%${codeFilter}%`);
      }

      if (searchFilter) {
        query = query.or(
          `bank_name.ilike.%${searchFilter}%,account_holder.ilike.%${searchFilter}%,bank_short_name.ilike.%${searchFilter}%`
        );
      }

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as BankAccount[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: BankAccountFormData) => {
      const { error } = await supabase
        .from("customer_bank_accounts")
        .insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-bank-accounts"] });
      toast.success("เพิ่มธนาคารสำเร็จ");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<BankAccountFormData>;
    }) => {
      const { error } = await supabase
        .from("customer_bank_accounts")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-bank-accounts"] });
      toast.success("อัปเดตสำเร็จ");
      setIsDialogOpen(false);
      setEditingAccount(null);
      resetForm();
    },
    onError: (error) => {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("customer_bank_accounts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-bank-accounts"] });
      toast.success("ลบธนาคารสำเร็จ");
      setDeleteAccount(null);
    },
    onError: (error) => {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({
      id,
      field,
      value,
    }: {
      id: string;
      field: string;
      value: boolean;
    }) => {
      const { error } = await supabase
        .from("customer_bank_accounts")
        .update({ [field]: value })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-bank-accounts"] });
    },
    onError: (error) => {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      bank_code: "",
      bank_short_name: "",
      bank_name: "",
      account_holder: "",
      account_number: "",
      notes: "",
      password_visible: false,
      deposit_enabled: true,
      withdrawal_enabled: true,
      status: "offline",
    });
  };

  const handleOpenAddDialog = () => {
    resetForm();
    setEditingAccount(null);
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (account: BankAccount) => {
    setEditingAccount(account);
    setFormData({
      bank_code: account.bank_code,
      bank_short_name: account.bank_short_name,
      bank_name: account.bank_name,
      account_holder: account.account_holder || "",
      account_number: account.account_number,
      notes: account.notes || "",
      password_visible: account.password_visible,
      deposit_enabled: account.deposit_enabled,
      withdrawal_enabled: account.withdrawal_enabled,
      status: account.status,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingAccount) {
      updateMutation.mutate({ id: editingAccount.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleToggle = (id: string, field: string, value: boolean) => {
    toggleMutation.mutate({ id, field, value });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">จัดการรายชื่อธนาคาร(ลูกค้า)</h1>
        </div>
        <Button onClick={handleOpenAddDialog} className="bg-green-600 hover:bg-green-700">
          <Building2 className="w-4 h-4 mr-2" />
          เพิ่มธนาคาร
        </Button>
      </div>

      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <Label>หัวหมด</Label>
          <Input
            placeholder="กรอง ตามสถานะ:"
            value={codeFilter}
            onChange={(e) => setCodeFilter(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <Label>ค้นหา</Label>
          <Input
            placeholder="ดีบหา ตามชื่อ"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={statusFilter === "all" ? "default" : "outline"}
            onClick={() => setStatusFilter("all")}
          >
            ทั้งหมด
          </Button>
          <Button
            variant={statusFilter === "online" ? "default" : "outline"}
            onClick={() => setStatusFilter("online")}
          >
            Online
          </Button>
          <Button
            variant={statusFilter === "offline" ? "default" : "outline"}
            onClick={() => setStatusFilter("offline")}
          >
            Offline
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-destructive">
            <TableRow className="hover:bg-destructive/90">
              <TableHead className="text-destructive-foreground font-bold">#</TableHead>
              <TableHead className="text-destructive-foreground font-bold">รหัสธนาคาร</TableHead>
              <TableHead className="text-destructive-foreground font-bold">ชื่อย่อธนาคาร</TableHead>
              <TableHead className="text-destructive-foreground font-bold">ธนาคาร</TableHead>
              <TableHead className="text-destructive-foreground font-bold">ชื่อผู้ใช้</TableHead>
              <TableHead className="text-destructive-foreground font-bold">เหรายเลขผู้ใช้</TableHead>
              <TableHead className="text-destructive-foreground font-bold">ชื่อผู้ใช้</TableHead>
              <TableHead className="text-destructive-foreground font-bold">รหัสผ่าน</TableHead>
              <TableHead className="text-destructive-foreground font-bold">ปิดขึ้นฝาก</TableHead>
              <TableHead className="text-destructive-foreground font-bold">ปิดขึ้นถอน</TableHead>
              <TableHead className="text-destructive-foreground font-bold">สถานะ</TableHead>
              <TableHead className="text-destructive-foreground font-bold">แก้ไข</TableHead>
              <TableHead className="text-destructive-foreground font-bold">ลบ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center">
                  กำลังโหลด...
                </TableCell>
              </TableRow>
            ) : accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center">
                  ไม่พบข้อมูล
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((account, index) => (
                <TableRow key={account.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-lg">
                          {BANK_LOGOS[account.bank_code] || "🏦"}
                        </AvatarFallback>
                      </Avatar>
                      <span>{account.bank_code}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-destructive font-medium">
                    {account.bank_short_name}
                  </TableCell>
                  <TableCell>{account.bank_name}</TableCell>
                  <TableCell>{account.account_holder || "-"}</TableCell>
                  <TableCell>{account.account_number}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {account.notes || "-"}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={account.password_visible}
                      onCheckedChange={(checked) =>
                        handleToggle(account.id, "password_visible", checked)
                      }
                      className={account.password_visible ? "bg-destructive" : ""}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={account.deposit_enabled}
                      onCheckedChange={(checked) =>
                        handleToggle(account.id, "deposit_enabled", checked)
                      }
                      className={account.deposit_enabled ? "bg-destructive" : ""}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={account.withdrawal_enabled}
                      onCheckedChange={(checked) =>
                        handleToggle(account.id, "withdrawal_enabled", checked)
                      }
                      className={account.withdrawal_enabled ? "bg-destructive" : ""}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={account.status === "online" ? "default" : "destructive"}
                      className={
                        account.status === "online"
                          ? "bg-green-600 hover:bg-green-700"
                          : ""
                      }
                    >
                      {account.status === "online" ? "Online" : "Offline"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => handleOpenEditDialog(account)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteAccount(account)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? "แก้ไขธนาคาร" : "เพิ่มธนาคาร"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>รหัสธนาคาร *</Label>
              <Input
                value={formData.bank_code}
                onChange={(e) =>
                  setFormData({ ...formData, bank_code: e.target.value })
                }
                placeholder="เช่น GSB, KBANK"
              />
            </div>
            <div>
              <Label>ชื่อย่อธนาคาร *</Label>
              <Input
                value={formData.bank_short_name}
                onChange={(e) =>
                  setFormData({ ...formData, bank_short_name: e.target.value })
                }
                placeholder="เช่น GSB-01"
              />
            </div>
            <div className="col-span-2">
              <Label>ชื่อธนาคาร *</Label>
              <Input
                value={formData.bank_name}
                onChange={(e) =>
                  setFormData({ ...formData, bank_name: e.target.value })
                }
                placeholder="เช่น ธนาคารออมสิน"
              />
            </div>
            <div>
              <Label>ชื่อผู้ใช้</Label>
              <Input
                value={formData.account_holder}
                onChange={(e) =>
                  setFormData({ ...formData, account_holder: e.target.value })
                }
                placeholder="ชื่อเจ้าของบัญชี"
              />
            </div>
            <div>
              <Label>เลขบัญชี *</Label>
              <Input
                value={formData.account_number}
                onChange={(e) =>
                  setFormData({ ...formData, account_number: e.target.value })
                }
                placeholder="เลขที่บัญชี"
              />
            </div>
            <div className="col-span-2">
              <Label>หมายเหตุ</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="หมายเหตุเพิ่มเติม"
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.password_visible}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, password_visible: checked })
                }
              />
              <Label>แสดงรหัสผ่าน</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.deposit_enabled}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, deposit_enabled: checked })
                }
              />
              <Label>เปิดใช้งานฝาก</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.withdrawal_enabled}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, withdrawal_enabled: checked })
                }
              />
              <Label>เปิดใช้งานถอน</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.status === "online"}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    status: checked ? "online" : "offline",
                  })
                }
              />
              <Label>สถานะ Online</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                !formData.bank_code ||
                !formData.bank_short_name ||
                !formData.bank_name ||
                !formData.account_number
              }
            >
              {editingAccount ? "บันทึก" : "เพิ่ม"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteAccount}
        onOpenChange={() => setDeleteAccount(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบธนาคาร {deleteAccount?.bank_name} (
              {deleteAccount?.bank_short_name}) ใช่หรือไม่?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAccount && deleteMutation.mutate(deleteAccount.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CustomerBankAccounts;
