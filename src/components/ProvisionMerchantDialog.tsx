import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Copy, Check, AlertTriangle, Shield } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { use2FAChallenge } from "@/hooks/use2FAChallenge";
import { TwoFactorChallenge } from "@/components/security/TwoFactorChallenge";
import { ScrollArea } from "@/components/ui/scroll-area";

const formSchema = z.object({
  business_name: z.string().min(2, "ชื่อธุรกิจต้องมีอย่างน้อย 2 ตัวอักษร"),
  owner_user_id: z.string().min(1, "กรุณากรอก Owner User ID"),
  owner_name: z.string().min(2, "ชื่อต้องมีอย่างน้อย 2 ตัวอักษร"),
  owner_type: z.enum(["Game1", "Game2", "Game3"], { required_error: "กรุณาเลือก Owner Type" }),
  business_type: z.string().min(1, "กรุณาเลือกประเภทธุรกิจ"),
  force_2fa: z.boolean().default(true),
  payment_deposit_percentage: z.number().min(0).max(100).default(0),
  payment_withdrawal_percentage: z.number().min(0).max(100).default(0),
  features: z.array(z.string()).default([]),
});

interface ProvisionMerchantDialogProps {
  children?: React.ReactNode;
}

export function ProvisionMerchantDialog({ children }: ProvisionMerchantDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [provisionedTenant, setProvisionedTenant] = useState<any>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const { isOpen, setIsOpen, checkAndChallenge, onSuccess } = use2FAChallenge();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      business_name: "",
      owner_user_id: "",
      owner_name: "",
      owner_type: "Game1",
      business_type: "",
      force_2fa: true,
      payment_deposit_percentage: 0,
      payment_withdrawal_percentage: 0,
      features: ["payments", "refunds", "api_access"],
    },
  });

  const { data: platformPolicy } = useQuery({
    queryKey: ["platform-security-policy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_security_policy")
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const provisionMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("ไม่พบ session");

      const { data: result, error } = await supabase.functions.invoke("create-owner-user", {
        body: {
          owner_user_id: data.owner_user_id,
          owner_name: data.owner_name,
          owner_type: data.owner_type,
          tenant_name: data.business_name,
          business_type: data.business_type,
          force_2fa: data.force_2fa,
          payment_deposit_percentage: data.payment_deposit_percentage,
          payment_withdrawal_percentage: data.payment_withdrawal_percentage,
          features: data.features,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      return result;
    },
    onSuccess: async (data) => {
      toast.success("สร้าง Merchant สำเร็จ");
      setProvisionedTenant(data);
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
      
      // Log provisioning action
      await supabase.from("audit_logs").insert({
        action: "super_admin.tenant.provisioned",
        actor_user_id: user?.id,
        target: data.tenant?.id,
        ip: null,
        user_agent: navigator.userAgent,
        after: {
          tenant_id: data.tenant?.id,
          tenant_name: data.tenant?.name,
          owner_user_id: data.owner_user_id,
          owner_name: data.owner_name,
        },
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "เกิดข้อผิดพลาดในการสร้าง Merchant");
    },
  });

  const handleProvision = (data: z.infer<typeof formSchema>) => {
    checkAndChallenge(() => provisionMutation.mutate(data));
  };

  const [copiedApiKey, setCopiedApiKey] = useState(false);

  const handleCopyPassword = () => {
    if (provisionedTenant?.temporary_password) {
      navigator.clipboard.writeText(provisionedTenant.temporary_password);
      setCopiedPassword(true);
      toast.success("คัดลอกรหัสผ่านแล้ว");
      setTimeout(() => setCopiedPassword(false), 2000);
    }
  };

  const handleCopyApiKey = () => {
    if (provisionedTenant?.api_key) {
      navigator.clipboard.writeText(provisionedTenant.api_key);
      setCopiedApiKey(true);
      toast.success("คัดลอก API Key แล้ว");
      setTimeout(() => setCopiedApiKey(false), 2000);
    }
  };

  const handleReset = () => {
    setProvisionedTenant(null);
    form.reset();
  };

  const handleClose = () => {
    setOpen(false);
    setProvisionedTenant(null);
    setCopiedPassword(false);
    setCopiedApiKey(false);
    form.reset();
  };

  const availableFeatures = [
    { id: "payments", label: "Payment Processing" },
    { id: "refunds", label: "Refund Management" },
    { id: "api_access", label: "API Access" },
    { id: "webhooks", label: "Webhook Integration" },
    { id: "advanced_reporting", label: "Advanced Reporting" },
    { id: "multi_currency", label: "Multi-Currency Support" },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {children || (
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              สร้าง Merchant
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {provisionedTenant ? "Merchant ถูกสร้างแล้ว" : "สร้าง Merchant ใหม่"}
            </DialogTitle>
            <DialogDescription>
              {provisionedTenant 
                ? "บัญชี Merchant และ Workspace ถูกสร้างเรียบร้อยแล้ว"
                : "กรอกข้อมูลเพื่อสร้าง Merchant Workspace และบัญชี Owner"
              }
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
            {provisionedTenant ? (
              <div className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>สำคัญ:</strong> กรุณาบันทึกข้อมูลนี้ รหัสผ่านชั่วคราวจะไม่แสดงอีกครั้ง
                  </AlertDescription>
                </Alert>

                <div className="rounded-lg border p-4 space-y-4">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Tenant/Workspace</div>
                    <div className="text-lg font-semibold">{provisionedTenant.tenant.name}</div>
                    <div className="text-xs text-muted-foreground">ID: {provisionedTenant.tenant.id}</div>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Owner User ID</div>
                    <div className="text-lg font-semibold">{provisionedTenant.owner_user_id}</div>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Owner Name</div>
                    <div className="text-lg font-semibold">{provisionedTenant.owner_name}</div>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Owner Type</div>
                    <div className="text-lg font-semibold">{provisionedTenant.owner_type}</div>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-muted-foreground">รหัสผ่าน Login</div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-sm">
                        {provisionedTenant.temporary_password}
                      </code>
                      <Button size="sm" variant="outline" onClick={handleCopyPassword}>
                        {copiedPassword ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      ส่งรหัสผ่านนี้ให้ลูกค้าเพื่อ Login เข้าระบบ
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-muted-foreground">API Key</div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-sm break-all">
                        {provisionedTenant.api_key}
                      </code>
                      <Button size="sm" variant="outline" onClick={handleCopyApiKey}>
                        {copiedApiKey ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      ส่ง API Key นี้ให้ลูกค้าสำหรับการเชื่อมต่อระบบ
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="secondary">
                      2FA: {provisionedTenant.force_2fa ? "บังคับ" : "ไม่บังคับ"}
                    </Badge>
                    <Badge variant="outline">
                      Type: {provisionedTenant.owner_type}
                    </Badge>
                    <Badge variant="outline">
                      Deposit: {provisionedTenant.payment_deposit_percentage || 0}%
                    </Badge>
                    <Badge variant="outline">
                      Withdrawal: {provisionedTenant.payment_withdrawal_percentage || 0}%
                    </Badge>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleReset} variant="outline" className="flex-1">
                    สร้าง Merchant ใหม่
                  </Button>
                  <Button onClick={handleClose} className="flex-1">
                    ปิด
                  </Button>
                </div>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleProvision)} className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">ข้อมูลธุรกิจ</h3>
                    
                    <FormField
                      control={form.control}
                      name="business_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ชื่อธุรกิจ</FormLabel>
                          <FormControl>
                            <Input placeholder="บริษัท ABC จำกัด" {...field} />
                          </FormControl>
                          <FormDescription>
                            ชื่อนี้จะเป็นชื่อ Tenant/Workspace
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="business_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ประเภทธุรกิจ</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="เลือกประเภทธุรกิจ" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="retail">ร้านค้าปลีก</SelectItem>
                              <SelectItem value="ecommerce">E-commerce</SelectItem>
                              <SelectItem value="saas">SaaS</SelectItem>
                              <SelectItem value="marketplace">Marketplace</SelectItem>
                              <SelectItem value="other">อื่นๆ</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4 border-t pt-4">
                    <h3 className="text-lg font-semibold">ข้อมูล Owner</h3>
                    
                    <FormField
                      control={form.control}
                      name="owner_user_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Owner User ID</FormLabel>
                          <FormControl>
                            <Input placeholder="USER001" {...field} />
                          </FormControl>
                          <FormDescription>
                            รหัสประจำตัวของ Owner ในระบบ
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="owner_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Owner Name</FormLabel>
                          <FormControl>
                            <Input placeholder="ชื่อ Owner" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="owner_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Owner Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="เลือก Owner Type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Game1">Game1</SelectItem>
                              <SelectItem value="Game2">Game2</SelectItem>
                              <SelectItem value="Game3">Game3</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            ประเภทของ Owner
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4 border-t pt-4">
                    <h3 className="text-lg font-semibold">การคำนวณรายได้</h3>

                    <FormField
                      control={form.control}
                      name="payment_deposit_percentage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Deposit (%)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.1" 
                              min="0"
                              max="100"
                              {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormDescription>
                            เปอร์เซ็นต์รายได้จากการฝากเงิน (0-100%)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="payment_withdrawal_percentage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Withdrawal (%)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.1" 
                              min="0"
                              max="100"
                              {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormDescription>
                            เปอร์เซ็นต์รายได้จากการถอนเงิน (Default: 0%)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="force_2fa"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              บังคับใช้ 2FA สำหรับ Owner
                            </FormLabel>
                            <FormDescription>
                              ต้องตั้งค่า 2FA เมื่อล็อกอินครั้งแรก (แนะนำ)
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="features"
                      render={() => (
                        <FormItem>
                          <div className="mb-4">
                            <FormLabel className="text-base">ฟีเจอร์ที่เปิดใช้งาน</FormLabel>
                            <FormDescription>
                              เลือกฟีเจอร์ที่จะเปิดให้ Tenant นี้ใช้งาน
                            </FormDescription>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            {availableFeatures.map((feature) => (
                              <FormField
                                key={feature.id}
                                control={form.control}
                                name="features"
                                render={({ field }) => {
                                  return (
                                    <FormItem
                                      key={feature.id}
                                      className="flex flex-row items-start space-x-3 space-y-0"
                                    >
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(feature.id)}
                                          onCheckedChange={(checked) => {
                                            return checked
                                              ? field.onChange([...field.value, feature.id])
                                              : field.onChange(
                                                  field.value?.filter(
                                                    (value) => value !== feature.id
                                                  )
                                                )
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="font-normal">
                                        {feature.label}
                                      </FormLabel>
                                    </FormItem>
                                  )
                                }}
                              />
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {platformPolicy?.force_2fa_for_super_admin && (
                    <Alert>
                      <Shield className="h-4 w-4" />
                      <AlertDescription>
                        การดำเนินการนี้ต้องมีการยืนยันตัวตนด้วย 2FA
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
                      ยกเลิก
                    </Button>
                    <Button type="submit" disabled={provisionMutation.isPending} className="flex-1">
                      {provisionMutation.isPending ? "กำลังสร้าง..." : "สร้าง Merchant"}
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <TwoFactorChallenge
        open={isOpen}
        onOpenChange={setIsOpen}
        onSuccess={onSuccess}
        title="ยืนยันตัวตนด้วย 2FA"
        description="กรุณากรอกรหัส 6 หลักจาก Authenticator App เพื่อสร้าง Merchant"
      />
    </>
  );
}
