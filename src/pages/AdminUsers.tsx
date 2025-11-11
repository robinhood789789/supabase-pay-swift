import { useState, useEffect } from "react";
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
import { Search, Shield, User, ShieldCheck, Eye, Trash2, UserX, Edit, Code, Edit2, Copy, RefreshCw } from "lucide-react";
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

const AdminUsers = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string; email: string } | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [editMemberDialogOpen, setEditMemberDialogOpen] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState<any>(null);
  const [newUserIds, setNewUserIds] = useState<string[]>([]);
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

  const { data: users, isLoading, refetch, isFetching } = useQuery({
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
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
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
    const matchesSearch = user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = selectedRole === "all" || user.role === selectedRole;
    const matchesStatus = selectedStatus === "all" || user.status === selectedStatus;
    
    return matchesSearch && matchesRole && matchesStatus;
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

  // Real-time subscription for new users and memberships
  useEffect(() => {
    if (!activeTenantId) return;

    const channel = supabase
      .channel('admin-users-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          console.log('🔔 New user created:', payload);
          const newUserId = payload.new.id;
          
          // Add to highlight list
          setNewUserIds(prev => [...prev, newUserId]);
          
          // Remove from highlight list after 2 seconds
          setTimeout(() => {
            setNewUserIds(prev => prev.filter(id => id !== newUserId));
          }, 2000);
          
          toast.success('ผู้ใช้ใหม่ถูกเพิ่มเข้ามา');
          queryClient.invalidateQueries({ queryKey: ["admin-users", activeTenantId] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'memberships',
          filter: `tenant_id=eq.${activeTenantId}`
        },
        (payload) => {
          console.log('🔔 New membership created:', payload);
          const userId = payload.new.user_id;
          
          // Add to highlight list
          setNewUserIds(prev => [...prev, userId]);
          
          // Remove from highlight list after 2 seconds
          setTimeout(() => {
            setNewUserIds(prev => prev.filter(id => id !== userId));
          }, 2000);
          
          queryClient.invalidateQueries({ queryKey: ["admin-users", activeTenantId] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'memberships',
          filter: `tenant_id=eq.${activeTenantId}`
        },
        (payload) => {
          console.log('🔔 Membership updated:', payload);
          queryClient.invalidateQueries({ queryKey: ["admin-users", activeTenantId] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          console.log('🔔 Profile updated:', payload);
          queryClient.invalidateQueries({ queryKey: ["admin-users", activeTenantId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTenantId, queryClient]);

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
            <CardTitle>รายชื่อผู้ใช้ทั้งหมด</CardTitle>
            <CardDescription>
              จำนวนผู้ใช้: {filteredUsers?.length || 0} / {users?.length || 0} คน
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาด้วยอีเมลหรือชื่อ..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="กรองตาม Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.name}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="กรองตามสถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => {
                  refetch();
                  toast.success("รีเฟรชข้อมูลเรียบร้อย");
                }}
                disabled={isFetching}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                รีเฟรช
              </Button>
              <PermissionGate allowOwner={true}>
                <Button
                  variant="destructive"
                  onClick={handleBulkDeleteClick}
                  disabled={selectedUserIds.length === 0}
                >
                  <UserX className="w-4 h-4 mr-2" />
                  ลบที่เลือก ({selectedUserIds.length})
                </Button>
              </PermissionGate>
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
                      <TableRow 
                        key={user.id}
                        className={newUserIds.includes(user.id) ? 'animate-highlight-fade' : ''}
                      >
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
                            <div className="flex items-center gap-2">
                              <span>{user.full_name || "ไม่ระบุชื่อ"}</span>
                              {newUserIds.includes(user.id) && (
                                <Badge className="animate-highlight-fade bg-success text-success-foreground text-xs">
                                  NEW
                                </Badge>
                              )}
                            </div>
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
