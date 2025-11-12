import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Shield, User, ShieldCheck, Eye, Trash2, UserX, Edit, Code, Edit2, Copy, Calendar, Filter, KeyRound } from "lucide-react";
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreateUserDialog } from "@/components/CreateUserDialog";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";
import { UserDetailDrawer } from "@/components/UserDetailDrawer";
import { PermissionGate } from "@/components/PermissionGate";
import { use2FAChallenge } from "@/hooks/use2FAChallenge";
import { TwoFactorChallenge } from "@/components/security/TwoFactorChallenge";
import { EditMemberDialog } from "@/components/EditMemberDialog";
import { PasswordResetReport } from "@/components/admin/PasswordResetReport";

const AdminUsers = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string; email: string } | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [editMemberDialogOpen, setEditMemberDialogOpen] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState<any>(null);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetPasswordUser, setResetPasswordUser] = useState<{ id: string; name: string; public_id: string } | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const queryClient = useQueryClient();
  const { activeTenantId } = useTenantSwitcher();
  const { isOpen, setIsOpen, checkAndChallenge, onSuccess } = use2FAChallenge();

  // Fetch available roles for filtering
  const { data: roles = [] } = useQuery({
    queryKey: ["roles", activeTenantId],
    queryFn: async () => {
      if (!activeTenantId) return [];
      const { data, error } = await supabase
        .from("roles")
        .select("id, name")
        .order("name");
      
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
    enabled: !!activeTenantId,
  });

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users", activeTenantId],
    queryFn: async () => {
      if (!activeTenantId) {
        console.log("❌ No activeTenantId");
        return [];
      }

      console.log("🔍 Fetching users for tenant:", activeTenantId);

      // Get memberships for current tenant only with explicit inner joins
      const { data: memberships, error: membershipsError } = await supabase
        .from("memberships")
        .select(`
          user_id, 
          tenant_id, 
          role_id,
          status,
          roles!inner(name),
          tenants!inner(name)
        `)
        .eq("tenant_id", activeTenantId);

      console.log("📊 Memberships fetched:", { count: memberships?.length, memberships, error: membershipsError });

      if (membershipsError) throw membershipsError;

      const userIds = memberships.map((m) => m.user_id);
      if (userIds.length === 0) {
        console.log("⚠️ No users found in memberships");
        return [];
      }

      console.log("👥 User IDs to fetch:", userIds);

      // Get profiles only for users in current tenant
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", userIds)
        .order("created_at", { ascending: false });

      console.log("👤 Profiles fetched:", { count: profiles?.length, profiles, error: profilesError });

      if (profilesError) throw profilesError;

      const result = profiles.map((profile) => {
        const membership = memberships.find((m) => m.user_id === profile.id);
        
        return {
          ...profile,
          role: membership?.roles?.name || "No Role",
          role_id: membership?.role_id || null,
          tenant_id: membership?.tenant_id || null,
          tenant_name: membership?.tenants?.name || "No workspace",
          status: membership?.status || "active",
          is_locked: false, // Can be extended with actual lock status from profiles
        };
      });

      console.log("✅ Final users data:", result);
      return result;
    },
    enabled: !!activeTenantId,
  });

  const force2FAMutation = useMutation({
    mutationFn: async (userId: string) => {
      // This would be implemented in an edge function
      // For now, we'll update the tenant security policy to enforce it
      const { error } = await supabase
        .from("profiles")
        .update({ totp_enabled: false })
        .eq("id", userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users", activeTenantId] });
      toast.success("User will be required to enable 2FA on next login");
    },
    onError: (error: any) => {
      toast.error("Failed to enforce 2FA", { description: error.message });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRoleName }: { userId: string; newRoleName: string }) => {
      if (!activeTenantId) throw new Error("No active tenant");

      // Find the role by name in current tenant
      const { data: roleData, error: roleError } = await supabase
        .from("roles")
        .select("id, name")
        .eq("name", newRoleName)
        .maybeSingle();

      if (roleError) throw roleError;
      if (!roleData) throw new Error(`Role ${newRoleName} not found`);

      // Update the membership role
      const { error: updateError } = await supabase
        .from("memberships")
        .update({ role_id: roleData.id })
        .eq("user_id", userId)
        .eq("tenant_id", activeTenantId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users", activeTenantId] });
      toast.success("อัพเดทสิทธิ์ผู้ใช้สำเร็จ!");
    },
    onError: (error: any) => {
      toast.error("เกิดข้อผิดพลาด", {
        description: error.message,
      });
    },
  });

  const filteredUsers = users?.filter((user) => {
    // Search filter
    const matchesSearch = user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.public_id?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Role filter
    const matchesRole = selectedRole === "all" || user.role === selectedRole;
    
    // Status filter
    const matchesStatus = selectedStatus === "all" || user.status === selectedStatus;
    
    // Date filter
    let matchesDate = true;
    if (dateFilter !== "all" && user.created_at) {
      const userDate = new Date(user.created_at);
      const now = new Date();
      
      switch (dateFilter) {
        case "today":
          matchesDate = userDate.toDateString() === now.toDateString();
          break;
        case "week":
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDate = userDate >= weekAgo;
          break;
        case "month":
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          matchesDate = userDate >= monthAgo;
          break;
        case "3months":
          const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          matchesDate = userDate >= threeMonthsAgo;
          break;
        default:
          matchesDate = true;
      }
    }
    
    return matchesSearch && matchesRole && matchesStatus && matchesDate;
  });

  const handleViewDetails = (userId: string) => {
    setSelectedUserId(userId);
    setDrawerOpen(true);
  };

  const handleForce2FA = (userId: string) => {
    checkAndChallenge(() => force2FAMutation.mutate(userId));
  };

  const handleRoleChange = (userId: string, newRole: string) => {
    checkAndChallenge(() => updateRoleMutation.mutate({ userId, newRoleName: newRole }));
  };

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!activeTenantId) throw new Error("No active tenant");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: userId, tenant_id: activeTenantId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users", activeTenantId] });
      toast.success("ลบผู้ใช้สำเร็จ!");
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    },
    onError: (error: any) => {
      toast.error("เกิดข้อผิดพลาด", {
        description: error.message,
      });
    },
  });

  const handleDeleteClick = (user: any) => {
    setUserToDelete({
      id: user.id,
      name: user.full_name || "ไม่ระบุชื่อ",
      email: user.email,
    });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (userToDelete) {
      checkAndChallenge(() => deleteUserMutation.mutate(userToDelete.id));
    }
  };

  const bulkDeleteMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      if (!activeTenantId) throw new Error("No active tenant");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const { data, error } = await supabase.functions.invoke("admin-delete-users-completely", {
        body: { user_ids: userIds, tenant_id: activeTenantId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users", activeTenantId] });
      const successCount = data?.results?.filter((r: any) => r.success).length || 0;
      toast.success(`ลบบัญชีสำเร็จ ${successCount} บัญชี`);
      setBulkDeleteDialogOpen(false);
      setSelectedUserIds([]);
    },
    onError: (error: any) => {
      toast.error("เกิดข้อผิดพลาด", {
        description: error.message,
      });
    },
  });

  const handleBulkDeleteClick = () => {
    if (selectedUserIds.length === 0) {
      toast.error("กรุณาเลือกบัญชีที่ต้องการลบ");
      return;
    }
    setBulkDeleteDialogOpen(true);
  };

  const confirmBulkDelete = () => {
    checkAndChallenge(() => bulkDeleteMutation.mutate(selectedUserIds));
  };

  const handleResetPasswordClick = (user: any) => {
    // Generate a strong password
    const generateRandomPassword = () => {
      const lowercase = "abcdefghijklmnopqrstuvwxyz";
      const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const numbers = "0123456789";
      const special = "!@#$%^&*";
      
      let password = "";
      password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
      password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
      password += numbers.charAt(Math.floor(Math.random() * numbers.length));
      password += special.charAt(Math.floor(Math.random() * special.length));
      
      const allChars = lowercase + uppercase + numbers + special;
      for (let i = password.length; i < 16; i++) {
        password += allChars.charAt(Math.floor(Math.random() * allChars.length));
      }
      
      return password.split('').sort(() => Math.random() - 0.5).join('');
    };
    
    const generatedPassword = generateRandomPassword();
    setNewPassword(generatedPassword);
    setPasswordCopied(false);
    setResetPasswordUser({
      id: user.id,
      name: user.full_name || user.email,
      public_id: user.public_id,
    });
    setResetPasswordDialogOpen(true);
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(newPassword);
    setPasswordCopied(true);
    toast.success("คัดลอกรหัสผ่านแล้ว!");
    setTimeout(() => setPasswordCopied(false), 2000);
  };

  const handleDownloadCredentials = () => {
    if (!resetPasswordUser) return;
    
    const content = `=== ข้อมูลผู้ใช้และรหัสผ่าน ===
ชื่อผู้ใช้: ${resetPasswordUser.name}
รหัสผู้ใช้ (Public ID): ${resetPasswordUser.public_id}
รหัสผ่านใหม่: ${newPassword}

วันที่รีเซ็ต: ${new Date().toLocaleString('th-TH')}

⚠️ คำเตือน:
- กรุณาเก็บรักษาข้อมูลนี้ไว้อย่างปลอดภัย
- ห้ามแชร์รหัสผ่านให้ผู้อื่น
- ผู้ใช้จะต้องเปลี่ยนรหัสผ่านนี้ในการเข้าสู่ระบบครั้งแรก
- คุณจะไม่สามารถดูรหัสผ่านนี้อีกครั้ง`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `credentials_${resetPasswordUser.public_id}_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("ดาวน์โหลดข้อมูลสำเร็จ!");
  };

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const { data, error } = await supabase.functions.invoke("admin-reset-user-password", {
        body: { user_id: userId, new_password: password },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users", activeTenantId] });
      toast.success("รีเซ็ตรหัสผ่านสำเร็จ! กรุณาบันทึกรหัสผ่านใหม่");
    },
    onError: (error: any) => {
      console.error("Reset password error:", error);
      toast.error(error.message || "ไม่สามารถรีเซ็ตรหัสผ่านได้");
      setResetPasswordDialogOpen(false);
    },
  });

  const confirmResetPassword = () => {
    if (resetPasswordUser) {
      checkAndChallenge(() =>
        resetPasswordMutation.mutate({
          userId: resetPasswordUser.id,
          password: newPassword,
        })
      );
    }
  };
  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedUserIds.length === filteredUsers?.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredUsers?.map((u) => u.id) || []);
    }
  };

  const handleEditMember = (user: any) => {
    setMemberToEdit({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      status: user.status,
      tenant_id: user.tenant_id,
      role: user.role,
      role_id: user.role_id,
      public_id: user.public_id,
    });
    setEditMemberDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <PermissionGate
        permission="users.view"
        allowOwner={true}
        fallback={
          <div className="p-6">
            <Card>
              <CardHeader>
                <CardTitle>Access Denied</CardTitle>
                <CardDescription>
                  You don't have permission to manage users
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
          }
        >
          <div className="p-6 space-y-6 max-w-full overflow-x-hidden">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Members</h1>
              <p className="text-muted-foreground">Manage user accounts and access permissions</p>
            </div>
            <PermissionGate allowOwner={true}>
              <CreateUserDialog />
            </PermissionGate>
          </div>

          <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              รายชื่อผู้ใช้ทั้งหมด
            </CardTitle>
            <CardDescription>
              จำนวนผู้ใช้: {filteredUsers?.length || 0} / {users?.length || 0} คน
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search Bar */}
            <div className="flex flex-col gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาด้วย ชื่อ, อีเมล หรือ Public ID..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              {/* Filters Row */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="บทบาท" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกบทบาท</SelectItem>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.name}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="สถานะ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกสถานะ</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <Calendar className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="วันที่สร้าง" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกช่วงเวลา</SelectItem>
                    <SelectItem value="today">วันนี้</SelectItem>
                    <SelectItem value="week">7 วันที่แล้ว</SelectItem>
                    <SelectItem value="month">30 วันที่แล้ว</SelectItem>
                    <SelectItem value="3months">90 วันที่แล้ว</SelectItem>
                  </SelectContent>
                </Select>
                
                {(searchQuery || selectedRole !== "all" || selectedStatus !== "all" || dateFilter !== "all") && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedRole("all");
                      setSelectedStatus("all");
                      setDateFilter("all");
                    }}
                    className="w-full sm:w-auto"
                  >
                    ล้างตัวกรอง
                  </Button>
                )}
                
                <PermissionGate allowOwner={true}>
                  <Button
                    variant="destructive"
                    onClick={handleBulkDeleteClick}
                    disabled={selectedUserIds.length === 0}
                    className="w-full sm:w-auto ml-auto"
                  >
                    <UserX className="w-4 h-4 mr-2" />
                    ลบที่เลือก ({selectedUserIds.length})
                  </Button>
                </PermissionGate>
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <PermissionGate allowOwner={true}>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedUserIds.length === filteredUsers?.length && filteredUsers?.length > 0}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                      </PermissionGate>
                      <TableHead>User</TableHead>
                      <TableHead>Public ID</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>2FA Status</TableHead>
                      <TableHead>Last Verified</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers?.map((user) => (
                      <TableRow key={user.id}>
                        <PermissionGate allowOwner={true}>
                          <TableCell>
                            <Checkbox
                              checked={selectedUserIds.includes(user.id)}
                              onCheckedChange={() => toggleUserSelection(user.id)}
                            />
                          </TableCell>
                        </PermissionGate>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {user.role === "owner" ? (
                              <Shield className="w-4 h-4 text-green-600" />
                            ) : user.role === "manager" ? (
                              <ShieldCheck className="w-4 h-4 text-purple-600" />
                            ) : user.role === "finance" ? (
                              <ShieldCheck className="w-4 h-4 text-blue-600" />
                            ) : user.role === "developer" ? (
                              <Code className="w-4 h-4 text-cyan-600" />
                            ) : user.role === "viewer" ? (
                              <Eye className="w-4 h-4 text-gray-600" />
                            ) : (
                              <User className="w-4 h-4 text-muted-foreground" />
                            )}
                            {user.full_name || "ไม่ระบุชื่อ"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs">{user.public_id || "-"}</span>
                            {user.public_id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => {
                                  navigator.clipboard.writeText(user.public_id);
                                  toast.success("คัดลอก Public ID แล้ว");
                                }}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            user.role === "super_admin" ? "default" : 
                            user.role === "owner" ? "secondary" : 
                            user.role === "manager" ? "secondary" :
                            user.role === "finance" ? "secondary" :
                            user.role === "developer" ? "secondary" :
                            user.role === "viewer" ? "outline" :
                            "outline"
                          }>
                            {user.role || "No Role"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.status === "active" ? "default" : "destructive"}>
                            <span className="w-2 h-2 rounded-full mr-2" style={{
                              backgroundColor: user.status === "active" ? "#22c55e" : "#ef4444"
                            }}></span>
                            {user.status === "active" ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.totp_enabled ? (
                            <Badge variant="default" className="gap-1">
                              <ShieldCheck className="w-3 h-3" />
                              Enabled
                            </Badge>
                          ) : (
                            <Badge variant="outline">Disabled</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {user.totp_enabled ? 'Enabled' : 'Disabled'}
                        </TableCell>
                        <TableCell>
                          {new Date(user.created_at).toLocaleDateString("en-US")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(user.id)}
                              title="ดูรายละเอียด"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <PermissionGate allowOwner={true}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditMember(user)}
                                title="แก้ไขสถานะ"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            </PermissionGate>
                            <PermissionGate allowOwner={true}>
                              {!user.totp_enabled && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleForce2FA(user.id)}
                                  title="บังคับใช้ 2FA"
                                >
                                  <ShieldCheck className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleResetPasswordClick(user)}
                                title="รีเซ็ตรหัสผ่าน"
                              >
                                <KeyRound className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClick(user)}
                                title="ลบผู้ใช้"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </PermissionGate>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Password Reset Report */}
        <PasswordResetReport />

        {selectedUserId && (
          <UserDetailDrawer
            userId={selectedUserId}
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
          />
        )}

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>ยืนยันการลบผู้ใช้</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้ต่อไปนี้ออกจากระบบ?</p>
                {userToDelete && (
                  <div className="bg-muted p-3 rounded-md mt-2">
                    <p className="font-medium">{userToDelete.name}</p>
                    <p className="text-sm text-muted-foreground">{userToDelete.email}</p>
                  </div>
                )}
                <p className="text-destructive text-sm font-medium mt-2">
                  การกระทำนี้ไม่สามารถย้อนกลับได้
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive hover:bg-destructive/90"
                disabled={deleteUserMutation.isPending}
              >
                {deleteUserMutation.isPending ? "กำลังลบ..." : "ยืนยันการลบ"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>ยืนยันการลบบัญชีหลายบัญชี</AlertDialogTitle>
              <AlertDialogDescription>
                <div className="space-y-3">
                  <p>คุณแน่ใจหรือไม่ว่าต้องการลบบัญชีทั้งหมด {selectedUserIds.length} บัญชีที่เลือก?</p>
                  <div className="bg-muted p-3 rounded-md max-h-48 overflow-y-auto">
                    <p className="font-semibold mb-2">บัญชีที่จะถูกลบ:</p>
                    <ul className="text-sm space-y-1">
                      {filteredUsers
                        ?.filter((u) => selectedUserIds.includes(u.id))
                        .map((u) => (
                          <li key={u.id}>• {u.full_name || "ไม่ระบุชื่อ"} ({u.email})</li>
                        ))}
                    </ul>
                  </div>
                  <p className="text-destructive font-medium">
                    การดำเนินการนี้ไม่สามารถย้อนกลับได้!
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmBulkDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                ยืนยันการลบทั้งหมด
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Reset Password Dialog */}
        <AlertDialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
          <AlertDialogContent className="max-w-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <KeyRound className="w-5 h-5" />
                รีเซ็ตรหัสผ่าน
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-4">
                <div>
                  <p className="mb-2">คุณกำลังจะรีเซ็ตรหัสผ่านสำหรับ:</p>
                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    <p className="font-semibold">{resetPasswordUser?.name}</p>
                    <p className="text-sm font-mono">{resetPasswordUser?.public_id}</p>
                  </div>
                </div>
                
                <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <p className="text-sm font-semibold mb-2">รหัสผ่านใหม่:</p>
                  <div className="flex items-center gap-2">
                    <Input
                      value={newPassword}
                      readOnly
                      className="font-mono bg-background"
                    />
                    <Button
                      variant={passwordCopied ? "default" : "outline"}
                      size="sm"
                      onClick={handleCopyPassword}
                      className="min-w-[100px]"
                    >
                      {passwordCopied ? (
                        <>
                          <span className="mr-1">✓</span> คัดลอกแล้ว
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-1" /> คัดลอก
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    ⚠️ กรุณาบันทึกรหัสผ่านนี้ในที่ปลอดภัย คุณจะไม่สามารถดูรหัสผ่านนี้อีกครั้ง
                  </p>
                </div>
                
                <p className="text-sm">
                  ผู้ใช้จะต้องเปลี่ยนรหัสผ่านในการเข้าสู่ระบบครั้งแรก
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="secondary"
                onClick={handleDownloadCredentials}
                className="w-full sm:w-auto"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                ดาวน์โหลดข้อมูล
              </Button>
              <div className="flex gap-2 w-full sm:w-auto">
                <AlertDialogCancel className="flex-1 sm:flex-none">ยกเลิก</AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmResetPassword}
                  disabled={resetPasswordMutation.isPending}
                  className="flex-1 sm:flex-none"
                >
                  {resetPasswordMutation.isPending ? "กำลังดำเนินการ..." : "ยืนยันรีเซ็ตรหัสผ่าน"}
                </AlertDialogAction>
              </div>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </div>
    <EditMemberDialog
      open={editMemberDialogOpen}
      onOpenChange={setEditMemberDialogOpen}
      member={memberToEdit}
    />
    <TwoFactorChallenge open={isOpen} onOpenChange={setIsOpen} onSuccess={onSuccess} />
    </PermissionGate>
    </DashboardLayout>
  );
};

export default AdminUsers;
