import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Copy, Eye, EyeOff, Trash2, Search, Edit, KeyRound } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EditOwnerDialog } from "@/components/shareholder/EditOwnerDialog";
import { useShareholder } from "@/hooks/useShareholder";

type Owner = {
  ownerId: string;
  businessName: string;
  publicId: string;
  createdAt: string;
  status: string;
  email?: string;
  mrr?: number;
};

export default function ShareholderTeam() {
  const { toast } = useToast();
  const { shareholder } = useShareholder();
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [createdPublicId, setCreatedPublicId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ownerToDelete, setOwnerToDelete] = useState<Owner | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [ownerToEdit, setOwnerToEdit] = useState<Owner | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [ownerToReset, setOwnerToReset] = useState<Owner | null>(null);
  const [resetting, setResetting] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [formData, setFormData] = useState({
    business_name: "",
    email: "",
    prefix: "",
    number: "",
  });

  useEffect(() => {
    fetchOwners();
  }, []);

  const fetchOwners = async () => {
    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await supabase.functions.invoke('shareholder-referral-tenants', {
        headers: { Authorization: `Bearer ${token}` },
        body: { status: 'All' },
      });

      if (response.error) throw response.error;
      setOwners(response.data.data || []);
    } catch (error) {
      console.error('Error fetching owners:', error);
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถโหลดข้อมูลได้", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.business_name) {
      toast({ title: "กรุณากรอกชื่อธุรกิจ", variant: "destructive" });
      return;
    }

    if (!formData.prefix || !formData.number) {
      toast({ title: "กรุณากรอก Public ID ให้ครบถ้วน", variant: "destructive" });
      return;
    }

    // Validate prefix (2-6 uppercase letters/numbers)
    if (!/^[A-Z0-9]{2,6}$/.test(formData.prefix)) {
      toast({ title: "Prefix ต้องเป็นตัวอักษร/ตัวเลขภาษาอังกฤษ 2-6 ตัว", variant: "destructive" });
      return;
    }

    // Validate number (exactly 6 digits)
    if (!/^\d{6}$/.test(formData.number)) {
      toast({ title: "Number ต้องเป็นตัวเลข 6 หลักเท่านั้น", variant: "destructive" });
      return;
    }

    // Validate email format if provided
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast({ title: "รูปแบบอีเมลไม่ถูกต้อง", variant: "destructive" });
      return;
    }

    try {
      setCreating(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const public_id = `${formData.prefix}-${formData.number}`;

      const response = await supabase.functions.invoke('shareholder-create-owner', {
        headers: { Authorization: `Bearer ${token}` },
        body: {
          business_name: formData.business_name,
          email: formData.email,
          public_id: public_id,
        },
      });

      if (response.error) throw new Error(response.error.message || 'Failed to create owner');
      if (!response.data.success) throw new Error(response.data.error || 'Failed to create owner');

      setTempPassword(response.data.data.temporary_password);
      setCreatedPublicId(response.data.data.public_id);
      toast({ title: "สร้าง Owner สำเร็จ!", description: `Public ID: ${response.data.data.public_id}` });
      
      // Reset form
      setFormData({
        business_name: "",
        email: "",
        prefix: "",
        number: "",
      });

      fetchOwners();
    } catch (error: any) {
      console.error('Error creating owner:', error);
      toast({ 
        title: "สร้าง Owner ไม่สำเร็จ", 
        description: error.message || "เกิดข้อผิดพลาด",
        variant: "destructive" 
      });
    } finally {
      setCreating(false);
    }
  };

  const handleCopyPassword = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      toast({ title: "คัดลอกแล้ว", description: "รหัสผ่านชั่วคราวถูกคัดลอกไปยังคลิปบอร์ด" });
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setTempPassword(null);
    setCreatedPublicId(null);
    setShowPassword(false);
  };

  const handleDeleteClick = (owner: Owner) => {
    setOwnerToDelete(owner);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!ownerToDelete) return;

    try {
      setDeleting(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await supabase.functions.invoke('shareholder-delete-owner', {
        headers: { Authorization: `Bearer ${token}` },
        body: { tenant_id: ownerToDelete.ownerId },
      });

      if (response.error) throw new Error(response.error.message || 'Failed to delete owner');
      if (!response.data.success) throw new Error(response.data.error || 'Failed to delete owner');

      toast({
        title: "ลบ Owner และบัญชีสำเร็จ",
        description: `${ownerToDelete.businessName} และบัญชีทั้งหมดถูกลบออกจากระบบแล้ว`,
      });

      setDeleteDialogOpen(false);
      setOwnerToDelete(null);
      fetchOwners();
    } catch (error: any) {
      console.error('Error deleting owner:', error);
      toast({
        title: "ลบ Owner ไม่สำเร็จ",
        description: error.message || "เกิดข้อผิดพลาด",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleEditClick = (owner: Owner) => {
    setOwnerToEdit(owner);
    setEditDialogOpen(true);
  };

  const handleResetPasswordClick = (owner: Owner) => {
    setOwnerToReset(owner);
    setResetPasswordDialogOpen(true);
  };

  const generateSecurePassword = () => {
    const length = 16;
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const special = "!@#$%^&*";
    const all = uppercase + lowercase + numbers + special;
    
    let password = "";
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];
    
    for (let i = 4; i < length; i++) {
      password += all[Math.floor(Math.random() * all.length)];
    }
    
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  const handleResetPasswordConfirm = async () => {
    if (!ownerToReset) return;

    try {
      setResetting(true);

      // First, get the owner user_id from memberships
      const { data: membership, error: membershipError } = await supabase
        .from('memberships')
        .select('user_id')
        .eq('tenant_id', ownerToReset.ownerId)
        .maybeSingle();

      if (membershipError || !membership) {
        throw new Error('ไม่พบข้อมูล Owner user');
      }

      // Generate new password
      const generatedPassword = generateSecurePassword();

      // Call reset password edge function
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await supabase.functions.invoke('admin-reset-user-password', {
        headers: { Authorization: `Bearer ${token}` },
        body: {
          user_id: membership.user_id,
          new_password: generatedPassword,
        },
      });

      if (response.error) throw new Error(response.error.message || 'ไม่สามารถรีเซ็ตรหัสผ่านได้');
      if (!response.data.success) throw new Error(response.data.error || 'ไม่สามารถรีเซ็ตรหัสผ่านได้');

      setNewPassword(generatedPassword);
      toast({
        title: "รีเซ็ตรหัสผ่านสำเร็จ",
        description: `รหัสผ่านใหม่สำหรับ ${ownerToReset.publicId} ถูกสร้างแล้ว`,
      });
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast({
        title: "รีเซ็ตรหัสผ่านไม่สำเร็จ",
        description: error.message || "เกิดข้อผิดพลาด",
        variant: "destructive",
      });
    } finally {
      setResetting(false);
    }
  };

  const handleCloseResetDialog = () => {
    setResetPasswordDialogOpen(false);
    setOwnerToReset(null);
    setNewPassword(null);
    setShowNewPassword(false);
  };

  const filteredOwners = owners.filter((owner) => {
    const matchesSearch =
      owner.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      owner.publicId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (owner.email && owner.email.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === "all" || owner.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">
            👥 ทีมงาน
          </h1>
          <p className="text-white/80 mt-2">
            จัดการบัญชี Owner ในทีมของคุณ
          </p>
          {shareholder && (
            <div className="flex flex-col gap-1 mt-3 text-sm">
              <div className="text-muted-foreground">
                <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent font-semibold">
                  Shareholder ID: {shareholder.id}
                </span>
              </div>
              <div className="text-muted-foreground">
                <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent font-semibold">
                  User ID: {shareholder.user_id}
                </span>
              </div>
            </div>
          )}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 shadow-lg hover:shadow-xl transition-all">
              <Plus className="h-4 w-4 mr-2" />
              สร้าง Owner ใหม่
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>สร้าง Owner User ใหม่</DialogTitle>
            </DialogHeader>

            {tempPassword ? (
              <div className="space-y-4">
                <Alert className="border-green-500 bg-green-50">
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-semibold text-green-900">สร้าง Owner สำเร็จ!</p>
                      <p className="text-sm text-green-800">
                        รหัสผ่านชั่วคราวจะแสดงเพียงครั้งเดียว กรุณาคัดลอกและส่งให้ Owner อย่างปลอดภัย
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>

                {createdPublicId && (
                  <div className="space-y-2">
                    <Label>Public ID</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={createdPublicId} 
                        readOnly 
                        className="font-mono text-lg font-semibold"
                      />
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => {
                          navigator.clipboard.writeText(createdPublicId);
                          toast({ title: "คัดลอกแล้ว", description: "Public ID ถูกคัดลอกไปยังคลิปบอร์ด" });
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ใช้ Public ID นี้ในการเข้าสู่ระบบ
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>รหัสผ่านชั่วคราว</Label>
                  <div className="flex gap-2">
                    <Input 
                      type={showPassword ? "text" : "password"}
                      value={tempPassword} 
                      readOnly 
                      className="font-mono"
                    />
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleCopyPassword}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Owner จะต้องสแกน QR เพื่อเปิดใช้งาน 2FA และเปลี่ยนรหัสผ่านในการเข้าสู่ระบบครั้งแรก
                  </p>
                </div>

                <Button onClick={handleCloseDialog} className="w-full">
                  ปิด
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Alert>
                  <AlertDescription>
                    กำหนด Public ID ของ Owner ด้วยตัวเอง (เช่น OWN-123456)
                  </AlertDescription>
                </Alert>

                <div>
                  <Label>ชื่อธุรกิจ *</Label>
                  <Input 
                    value={formData.business_name}
                    onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                    placeholder="บริษัท ABC จำกัด"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    ชื่อธุรกิจหรือองค์กร
                  </p>
                </div>

                <div>
                  <Label>Public ID *</Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input 
                        value={formData.prefix}
                        onChange={(e) => setFormData({ ...formData, prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) })}
                        placeholder="OWN"
                        maxLength={6}
                        className="uppercase font-mono text-center"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Prefix (2-6 ตัว)
                      </p>
                    </div>
                    <div className="flex items-center justify-center px-2 text-2xl font-bold text-muted-foreground">
                      -
                    </div>
                    <div className="flex-1">
                      <Input 
                        value={formData.number}
                        onChange={(e) => setFormData({ ...formData, number: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                        placeholder="123456"
                        maxLength={6}
                        className="font-mono text-center"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        ตัวเลข (6 หลัก)
                      </p>
                    </div>
                  </div>
                  {formData.prefix && formData.number && (
                    <div className="mt-2 p-2 bg-muted rounded-md">
                      <p className="text-sm text-muted-foreground">Preview:</p>
                      <p className="font-mono font-bold text-lg text-primary">
                        {formData.prefix}-{formData.number}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <Label>อีเมล (ไม่บังคับ)</Label>
                  <Input 
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="owner@example.com"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    หากไม่ระบุ ระบบจะสร้างอีเมลภายในให้อัตโนมัติ
                  </p>
                </div>

                <Button 
                  onClick={handleCreate} 
                  disabled={creating}
                  className="w-full"
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      กำลังสร้าง...
                    </>
                  ) : (
                    "สร้าง Owner"
                  )}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filter */}
      <Card className="border-purple-100 shadow-md hover:shadow-lg transition-all bg-gradient-to-br from-background to-purple-50/30 dark:from-card dark:to-purple-950/10">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-purple-400" />
              <Input
                placeholder="ค้นหาด้วยชื่อธุรกิจ, Public ID หรืออีเมล..."
                className="pl-10 border-purple-200 focus-visible:ring-purple-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px] border-purple-200 focus:ring-purple-400">
                <SelectValue placeholder="กรองตามสถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="churned">Churned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-purple-100 shadow-md hover:shadow-xl transition-all bg-gradient-to-br from-background to-purple-50/20 dark:from-card dark:to-purple-950/10">
        <CardHeader className="border-b border-purple-100">
          <CardTitle className="text-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                <span className="text-lg">👥</span>
              </div>
              <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Owner ทั้งหมด</span>
              <Badge className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 text-purple-700 dark:text-purple-300 border-purple-200">
                {filteredOwners.length} / {owners.length} คน
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
                <tr className="border-b border-purple-100">
                  <th className="text-left p-4 font-semibold text-purple-900 dark:text-purple-100">Public ID</th>
                  <th className="text-left p-4 font-semibold text-purple-900 dark:text-purple-100">ชื่อ</th>
                  <th className="text-left p-4 font-semibold text-purple-900 dark:text-purple-100">User ID</th>
                  <th className="text-left p-4 font-semibold text-purple-900 dark:text-purple-100">ยอดคงเหลือ</th>
                  <th className="text-left p-4 font-semibold text-purple-900 dark:text-purple-100">สถานะ</th>
                  <th className="text-center p-4 font-semibold text-purple-900 dark:text-purple-100">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredOwners.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      {searchQuery || statusFilter !== "all"
                        ? "ไม่พบ Owner ที่ตรงกับเงื่อนไขการค้นหา"
                        : "ยังไม่มี Owner user"}
                    </td>
                  </tr>
                ) : (
                  filteredOwners.map((owner) => (
                    <tr key={owner.ownerId} className="border-b border-purple-50 hover:bg-purple-50/50 dark:hover:bg-purple-950/10 transition-all">
                      <td className="p-3 font-mono font-semibold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">{owner.publicId}</td>
                      <td className="p-3 font-medium">{owner.businessName}</td>
                      <td className="p-3">
                        <div className="text-xs text-muted-foreground font-mono">
                          {owner.ownerId ? owner.ownerId.substring(0, 8) + '...' : '-'}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                          {owner.mrr ? `฿${owner.mrr.toLocaleString()}` : '-'}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge
                          className={
                            owner.status === "Active"
                              ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 shadow-sm"
                              : owner.status === "Trial"
                              ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0 shadow-sm"
                              : owner.status === "Churned"
                              ? "bg-gradient-to-r from-gray-400 to-gray-500 text-white border-0 shadow-sm"
                              : "bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 shadow-sm"
                          }
                        >
                          {owner.status}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-950/20 dark:text-blue-300 transition-all shadow-sm hover:shadow-md"
                            onClick={() => handleResetPasswordClick(owner)}
                          >
                            <KeyRound className="h-4 w-4 mr-1" />
                            รีเซ็ตรหัส
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-purple-200 text-purple-700 hover:bg-purple-50 hover:border-purple-300 dark:hover:bg-purple-950/20 dark:text-purple-300 transition-all shadow-sm hover:shadow-md"
                            onClick={() => handleEditClick(owner)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            แก้ไข
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ Owner</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ที่จะลบ <span className="font-semibold">{ownerToDelete?.businessName}</span> (Public ID: <span className="font-mono font-semibold">{ownerToDelete?.publicId}</span>)?
              <br /><br />
              <span className="text-destructive font-semibold">การกระทำนี้ไม่สามารถย้อนกลับได้</span> และจะลบข้อมูลทั้งหมดของ Owner นี้ออกจากระบบ
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  กำลังลบ...
                </>
              ) : (
                "ลบ Owner"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <EditOwnerDialog
        owner={ownerToEdit}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={fetchOwners}
      />

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={(open) => {
        if (!open) handleCloseResetDialog();
        else setResetPasswordDialogOpen(open);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>รีเซ็ตรหัสผ่าน Owner</DialogTitle>
          </DialogHeader>

          {newPassword ? (
            <div className="space-y-4">
              <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold text-green-900 dark:text-green-100">รีเซ็ตรหัสผ่านสำเร็จ!</p>
                    <p className="text-sm text-green-800 dark:text-green-200">
                      รหัสผ่านใหม่จะแสดงเพียงครั้งเดียว กรุณาคัดลอกและส่งให้ Owner อย่างปลอดภัย
                    </p>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Public ID</Label>
                <div className="flex gap-2">
                  <Input 
                    value={ownerToReset?.publicId || ''} 
                    readOnly 
                    className="font-mono text-lg font-semibold"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(ownerToReset?.publicId || '');
                      toast({ title: "คัดลอกแล้ว", description: "Public ID ถูกคัดลอกไปยังคลิปบอร์ด" });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>รหัสผ่านใหม่</Label>
                <div className="flex gap-2">
                  <Input 
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword} 
                    readOnly 
                    className="font-mono"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => {
                      navigator.clipboard.writeText(newPassword);
                      toast({ title: "คัดลอกแล้ว", description: "รหัสผ่านใหม่ถูกคัดลอกไปยังคลิปบอร์ด" });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Owner จะต้องเข้าสู่ระบบด้วยรหัสผ่านใหม่นี้ และระบบจะบังคับให้เปลี่ยนรหัสผ่าน
                </p>
              </div>

              <Button onClick={handleCloseResetDialog} className="w-full">
                ปิด
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold">คุณแน่ใจหรือไม่ว่าต้องการรีเซ็ตรหัสผ่านสำหรับ:</p>
                    <div className="bg-muted p-3 rounded-md">
                      <p className="text-sm"><span className="font-semibold">Public ID:</span> <span className="font-mono">{ownerToReset?.publicId}</span></p>
                      <p className="text-sm"><span className="font-semibold">ธุรกิจ:</span> {ownerToReset?.businessName}</p>
                    </div>
                    <p className="text-sm text-destructive">
                      ระบบจะสร้างรหัสผ่านใหม่และบังคับให้ Owner เปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งถัดไป
                    </p>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleCloseResetDialog}
                  disabled={resetting}
                  className="flex-1"
                >
                  ยกเลิก
                </Button>
                <Button 
                  onClick={handleResetPasswordConfirm}
                  disabled={resetting}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                >
                  {resetting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      กำลังรีเซ็ต...
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4 mr-2" />
                      รีเซ็ตรหัสผ่าน
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
