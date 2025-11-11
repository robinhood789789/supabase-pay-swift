import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserPlus, RefreshCw, Eye, EyeOff, Copy, Check } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";
import { invokeFunctionWithTenant } from "@/lib/supabaseFunctions";

import { CredentialsDialog } from "@/components/admin/CredentialsDialog";

const createUserSchema = z.object({
  prefix: z.string().min(1, "กรุณาใส่ Prefix").max(10, "Prefix ต้องไม่เกิน 10 ตัวอักษร"),
  user_number: z.string()
    .length(6, "ตัวเลขต้องเป็น 6 หลักเท่านั้น")
    .regex(/^\d{6}$/, "กรุณาใส่ตัวเลข 6 หลักเท่านั้น"),
  password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"),
  full_name: z.string().min(1, "กรุณาใส่ชื่อ"),
  role: z.string().min(1, "กรุณาเลือกบทบาท"),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;

// Generate random password
const generateRandomPassword = () => {
  const length = 12;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

export const CreateUserDialog = () => {
  const [open, setOpen] = useState(false);
  const [selectedPermissionGroups, setSelectedPermissionGroups] = useState<string[]>([]);
  const [showCredentials, setShowCredentials] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [credentials, setCredentials] = useState<{
    email: string;
    user_id: string;
    display_name: string;
    invitation_code?: string;
    code_id?: string;
    code_expires_at?: string;
    temp_password?: string;
  } | null>(null);
  const queryClient = useQueryClient();
  const { activeTenantId } = useTenantSwitcher();

  const form = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      prefix: "",
      user_number: "",
      password: "",
      full_name: "",
      role: "finance",
    },
  });

  // Fetch real permissions from database
  const { data: allPermissions = [] } = useQuery({
    queryKey: ["permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permissions")
        .select("id, name, description");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Group permissions - each selection will grant multiple permissions
  const permissionGroups = [
    {
      id: "deposits_manage",
      name: "สิทธิการเติมเงิน",
      description: "สิทธิ์ในการดูและสร้างคำขอฝากเงิน",
      permissions: ["deposits.view", "deposits.create"]
    },
    {
      id: "withdrawals_manage",
      name: "สิทธิการถอนเงิน",
      description: "สิทธิ์ในการดูและสร้างคำขอถอนเงิน",
      permissions: ["withdrawals.view", "withdrawals.create"]
    },
    {
      id: "payments_view",
      name: "สิทธิดูรายการชำระเงิน",
      description: "สิทธิ์ในการดูรายการชำระเงินเท่านั้น",
      permissions: ["payments.view"]
    },
    {
      id: "financial_view_only",
      name: "สิทธิดูความเคลื่อนไหวหน้าเติมเงินและถอนเงิน แต่ไม่มีสิทธิจัดการ",
      description: "สิทธิ์ในการดูรายละเอียดการเติมเงินและถอนเงินเท่านั้น ไม่สามารถสร้างหรือจัดการได้",
      permissions: ["deposits.view", "withdrawals.view"]
    },
    {
      id: "api_keys",
      name: "สิทธิการจัดการ API",
      description: "สิทธิ์ในการดูและจัดการ API Keys สำหรับการเชื่อมต่อระบบ",
      permissions: ["api_keys.view", "api_keys.manage"]
    }
  ];

  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserFormData) => {
      console.log('🔄 Starting user creation process...');
      
      // Get current user's tenant
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ No user found');
        throw new Error("ไม่พบข้อมูลผู้ใช้");
      }
      console.log('✅ Current user:', user.id);

      if (!activeTenantId) {
        console.error('❌ No active tenant ID');
        throw new Error("กรุณาเลือก Workspace ก่อนสร้างผู้ใช้");
      }
      console.log('✅ Active tenant:', activeTenantId);

      // Convert selected groups to individual permission IDs
      const selectedPermissionNames = selectedPermissionGroups.flatMap(groupId => {
        const group = permissionGroups.find(g => g.id === groupId);
        return group ? group.permissions : [];
      });

      // Get permission IDs from names
      const permissionIds = selectedPermissionNames
        .map(name => allPermissions.find(p => p.name === name)?.id)
        .filter(Boolean) as string[];

      // Generate public_id from prefix and user_number
      const public_id = `${data.prefix}-${data.user_number}`;
      console.log('📝 Form data:', { public_id, role: data.role, permissions: permissionIds.length });
      
      // Check CSRF token
      const csrfToken = localStorage.getItem('csrf_token');
      if (!csrfToken) {
        console.warn('⚠️ No CSRF token found, attempting to generate...');
        try {
          const { setCSRFToken } = await import('@/lib/security/csrf');
          await setCSRFToken(user.id);
          console.log('✅ CSRF token generated');
        } catch (err) {
          console.error('❌ Failed to generate CSRF token:', err);
        }
      } else {
        console.log('✅ CSRF token exists');
      }
      
      // Call edge function to create user (with automatic CSRF token)
      console.log('🚀 Calling create-admin-user edge function...');
      const { data: result, error } = await invokeFunctionWithTenant("create-admin-user", {
        body: {
          prefix: data.prefix,
          user_number: data.user_number,
          public_id: public_id,
          password: data.password,
          full_name: data.full_name,
          role: data.role,
          tenant_id: activeTenantId,
          permissions: permissionIds, // Send selected permission IDs
        },
      });

      if (error) {
        console.error('❌ Edge function error:', error);
        throw error;
      }
      if (result?.error) {
        console.error('❌ Result error:', result.error);
        throw new Error(result.error);
      }
      console.log('✅ User created successfully:', result);
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users", activeTenantId] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      
      const message = result?.message || "สร้างบัญชีผู้ใช้สำเร็จ!";
      toast.success(message);
      
      // Show credentials dialog with temporary password
      const public_id = `${form.getValues('prefix')}-${form.getValues('user_number')}`;
      setCredentials({
        email: public_id,  // Use public_id as email for display
        user_id: public_id,
        display_name: form.getValues('full_name'),
        invitation_code: result?.invitation_code,
        code_id: result?.code_id,
        code_expires_at: result?.code_expires_at,
        temp_password: temporaryPassword,
      });
      setShowCredentials(true);
      
      setOpen(false);
      form.reset();
      setSelectedPermissionGroups([]);
      setTemporaryPassword("");
    },
    onError: (error: any) => {
      console.error('❌ Mutation error:', error);
      
      // Show detailed error message
      let errorMessage = error.message || "ไม่สามารถสร้างบัญชีได้";
      if (error.code) {
        errorMessage = `[${error.code}] ${errorMessage}`;
      }
      
      toast.error("เกิดข้อผิดพลาด", {
        description: errorMessage,
        duration: 5000,
      });
    },
  });

  const handleCopyPassword = () => {
    if (temporaryPassword) {
      navigator.clipboard.writeText(temporaryPassword);
      setCopiedPassword(true);
      toast.success("คัดลอกรหัสผ่านแล้ว! พร้อมส่งให้ลูกน้องในทีม");
      setTimeout(() => setCopiedPassword(false), 3000);
    } else {
      toast.error("กรุณาสร้างรหัสผ่านก่อน");
    }
  };

  const onSubmit = (data: CreateUserFormData) => {
    createUserMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="gradient" className="gap-2">
          <UserPlus className="w-4 h-4" />
          เพิ่มผู้ใช้
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>สร้างบัญชีผู้ใช้ใหม่</DialogTitle>
          <DialogDescription>
            กรอกข้อมูลเพื่อสร้างบัญชีผู้ใช้ในระบบ
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 flex flex-col overflow-hidden">
            <div className="overflow-y-auto flex-1 space-y-3 pr-2">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ชื่อ-นามสกุล</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="prefix"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prefix</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="ACA" 
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="user_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ตัวเลข 6 หลัก</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="112233" 
                          maxLength={6}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="text-xs text-muted-foreground -mt-1">
                User ID: {form.watch('prefix') || 'PREFIX'}-{form.watch('user_number') || '000000'}
              </div>
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>รหัสผ่านชั่วคราว</FormLabel>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <FormControl>
                          <Input 
                            type={showPassword ? "text" : "password"} 
                            placeholder="••••••••" 
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              setTemporaryPassword(e.target.value);
                            }}
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          const newPassword = generateRandomPassword();
                          form.setValue("password", newPassword);
                          setTemporaryPassword(newPassword);
                          toast.success("สร้างรหัสผ่านสุ่มแล้ว");
                        }}
                        title="สร้างรหัสผ่านสุ่ม"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleCopyPassword}
                        disabled={!temporaryPassword}
                        title="คัดลอกรหัสผ่านเพื่อส่งให้ลูกน้อง"
                      >
                        {copiedPassword ? (
                          <Check className="h-4 w-4 text-success" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">
                      คลิกปุ่มรีเฟรชเพื่อสร้างรหัสผ่านสุ่ม หรือกรอกเอง • คลิกปุ่มคัดลอกเพื่อส่งให้ทีม
                    </p>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>บทบาท</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="เลือกบทบาท" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="finance">Finance</SelectItem>
                        <SelectItem value="developer">Developer</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Permission Groups Selection - 3 groups */}
              <div className="space-y-2">
                <FormLabel>สิทธิ์การเข้าถึง</FormLabel>
                <div className="rounded-md border p-3 space-y-3">
                  {permissionGroups.map((group) => (
                    <div key={group.id} className="flex items-start space-x-2">
                      <Checkbox
                        id={group.id}
                        checked={selectedPermissionGroups.includes(group.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedPermissionGroups([...selectedPermissionGroups, group.id]);
                          } else {
                            setSelectedPermissionGroups(
                              selectedPermissionGroups.filter((id) => id !== group.id)
                            );
                          }
                        }}
                      />
                      <div className="grid gap-0.5 leading-none">
                        <label
                          htmlFor={group.id}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {group.name}
                        </label>
                        <p className="text-xs text-muted-foreground">
                          {group.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  เลือกสิทธิ์ ({selectedPermissionGroups.length} จาก {permissionGroups.length} รายการ)
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t mt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                disabled={createUserMutation.isPending}
              >
                {createUserMutation.isPending ? "กำลังสร้าง..." : "สร้างบัญชี"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>

      {/* Show credentials dialog if invitation code was generated */}
      {credentials && (
        <CredentialsDialog
          open={showCredentials}
          onOpenChange={setShowCredentials}
          credentials={credentials}
        />
      )}
    </Dialog>
  );
};
