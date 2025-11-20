import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronLeft, ChevronRight, AlertCircle, Check } from "lucide-react";
import { toast } from "sonner";
import { invokeFunctionWithTenant } from "@/lib/supabaseFunctions";
import { use2FAChallenge } from "@/hooks/use2FAChallenge";
import { TwoFactorChallenge } from "@/components/security/TwoFactorChallenge";
import { CredentialsDialog } from "./CredentialsDialog";
import { FunctionsHttpError } from "@supabase/supabase-js";

interface CreatePartnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PartnerFormData {
  display_name: string;
  public_id: string;
  commission_type: "bounty" | "revenue_share" | "hybrid";
  commission_percent: number;
  bounty_amount: number;
  adjust_min_percent: number;
  adjust_max_percent: number;
  allow_self_adjust: boolean;
  linked_tenants: Array<{
    tenant_id: string;
    commission_rate?: number;
    bounty_amount?: number;
  }>;
}

export function CreatePartnerDialog({ open, onOpenChange }: CreatePartnerDialogProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<PartnerFormData>({
    display_name: "",
    public_id: "",
    commission_type: "revenue_share",
    commission_percent: 10,
    bounty_amount: 0,
    adjust_min_percent: 0,
    adjust_max_percent: 30,
    allow_self_adjust: false,
    linked_tenants: [],
  });

  const [showCredentials, setShowCredentials] = useState(false);
  const [credentials, setCredentials] = useState<{
    temp_password?: string;
    invite_link?: string;
    public_id: string;
    display_name: string;
    invitation_code?: string;
    code_id?: string;
    code_expires_at?: string;
    shareholder_id?: string;
  } | null>(null);

  const { isOpen: mfaOpen, setIsOpen: setMfaOpen, checkAndChallenge, onSuccess } = use2FAChallenge();

  // Check if public_id already exists
  const { data: publicIdCheck, isLoading: checkingPublicId } = useQuery({
    queryKey: ["check-partner-public-id", formData.public_id],
    queryFn: async () => {
      if (!formData.public_id.trim()) return { exists: false };
      
      // Validate format: PREFIX-NNNNNN
      const publicIdRegex = /^[A-Z0-9]{2,6}-[0-9]{6}$/;
      if (!publicIdRegex.test(formData.public_id)) {
        return { exists: false, invalidFormat: true };
      }
      
      const { data, error } = await invokeFunctionWithTenant("platform-partners-list", {
        body: { search: formData.public_id, pageSize: 1 },
      });
      
      if (error) return { exists: false };
      const partners = data?.partners || [];
      const exists = partners.some((p: any) => 
        p.public_id?.toUpperCase() === formData.public_id.toUpperCase()
      );
      return { 
        exists,
        invalidFormat: false,
        existingPartner: exists ? partners[0] : null
      };
    },
    enabled: formData.public_id.trim().length > 0,
    staleTime: 10000,
  });

  // Fetch available tenants
  const { data: tenants } = useQuery({
    queryKey: ["tenants-for-linking"],
    queryFn: async () => {
      const { data, error } = await invokeFunctionWithTenant("platform-partners-list", {
        body: {},
      });
      if (error) throw error;
      return data?.tenants || [];
    },
    enabled: step === 3,
  });

  const createMutation = useMutation({
    mutationFn: async (data: PartnerFormData) => {
      console.log('[CreatePartner] Calling platform-partners-create with data:', JSON.stringify(data, null, 2));
      
      try {
        const { data: result } = await invokeFunctionWithTenant("platform-partners-create", {
          body: data,
          throwOnError: true,
        });
        
        console.log('[CreatePartner] Success! Result:', result);
        return result as any;
      } catch (err: any) {
        console.error('[CreatePartner] Caught error:', err);
        
        // Surface server error details from Edge Function
        if (err instanceof FunctionsHttpError) {
          let serverMsg = 'เกิดข้อผิดพลาดจากระบบ กรุณาลองอีกครั้ง';
          let serverCode: string | undefined = undefined;
          try {
            const body = await err.context.json();
            serverMsg = body?.error || serverMsg;
            serverCode = body?.code;
          } catch {}
          
          if (serverCode === 'MFA_CHALLENGE_REQUIRED' || serverCode === 'MFA_ENROLL_REQUIRED') {
            // Re-open MFA dialog if backend says step-up is needed
            setMfaOpen(true);
          }
          throw { message: serverMsg, code: serverCode };
        }
        
        throw err;
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["platform-partners"] });
      setCredentials({
        temp_password: result.temp_password,
        invite_link: result.invite_link,
        public_id: formData.public_id,
        display_name: formData.display_name,
        invitation_code: result.invitation_code,
        code_id: result.code_id,
        code_expires_at: result.expires_at,
        shareholder_id: result.shareholder_id,
      });
      setShowCredentials(true);
      onOpenChange(false);
      toast.success("สร้างบัญชีพาร์ทเนอร์สำเร็จ");
    },
    onError: (error: any) => {
      console.error('[CreatePartner] Mutation error:', error);
      if (error?.code === "MFA_CHALLENGE_REQUIRED") {
        toast.error("ต้องการยืนยัน 2FA");
      } else {
        const errorMsg = error?.message || error?.error || "สร้างบัญชีล้มเหลว";
        toast.error(errorMsg, {
          description: error?.code ? `รหัสข้อผิดพลาด: ${error.code}` : undefined,
        });
      }
    },
  });

  const handleCreate = async () => {
    const canProceed = await checkAndChallenge(() => {
      createMutation.mutate(formData);
    });
    
    if (!canProceed) {
      console.log('MFA challenge required or failed - waiting for user action');
    }
  };

  const publicIdExists = publicIdCheck?.exists || false;
  const publicIdInvalid = publicIdCheck?.invalidFormat || false;
  const isStep1Valid = formData.display_name.trim() && formData.public_id.trim() && !publicIdExists && !publicIdInvalid;
  const isStep2Valid = true; // Commission fields always valid
  const canProceed = {
    1: isStep1Valid,
    2: isStep2Valid,
    3: true,
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>สร้างบัญชีพาร์ทเนอร์ (Shareholder Man)</DialogTitle>
            <DialogDescription>
              ขั้นตอนที่ {step} จาก 4 - {
                step === 1 ? "ข้อมูลบัญชี" :
                step === 2 ? "นโยบายคอมมิชัน" :
                step === 3 ? "ลิงก์ Owner Tenants (ตัวเลือก)" :
                "สรุปและยืนยัน"
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Progress indicator */}
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className={`h-2 w-12 rounded-full transition-colors ${
                    s <= step ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>

            {/* Step 1: Basic Info */}
            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>ข้อมูลบัญชีพาร์ทเนอร์</CardTitle>
                  <CardDescription>รหัสผ่านชั่วคราวจะถูกสร้างอัตโนมัติและแสดงครั้งเดียว</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="display_name">
                      ชื่อแสดงผล <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="display_name"
                      value={formData.display_name}
                      onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                      placeholder="เช่น บริษัท ABC จำกัด"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="public_id">
                      Public ID <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="public_id"
                        value={formData.public_id}
                        onChange={(e) => setFormData({ ...formData, public_id: e.target.value.toUpperCase() })}
                        placeholder="PEA-123456"
                        className={publicIdExists || publicIdInvalid ? "border-destructive" : ""}
                        maxLength={13}
                      />
                      {checkingPublicId && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      รูปแบบ: PREFIX-NNNNNN (เช่น PEA-123456)
                    </p>
                    {publicIdInvalid && (
                      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <p className="font-medium text-destructive">รูปแบบไม่ถูกต้อง</p>
                            <p className="text-muted-foreground">
                              กรุณากรอก Public ID ในรูปแบบ PREFIX-NNNNNN (PREFIX 2-6 ตัวอักษร ตามด้วยขีด และเลข 6 หลัก)
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    {publicIdExists && publicIdCheck?.existingPartner && (
                      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                          <div className="text-sm space-y-1">
                            <p className="font-medium text-destructive">Public ID นี้ถูกใช้แล้ว</p>
                            <p className="text-muted-foreground">
                              พาร์ทเนอร์ <span className="font-medium">{publicIdCheck.existingPartner.full_name}</span> ใช้ Public ID นี้อยู่แล้ว
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              กรุณาใช้อีเมลอื่น หรือแก้ไขข้อมูลพาร์ทเนอร์ที่มีอยู่แทน
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    {!publicIdExists && !publicIdInvalid && formData.public_id.trim() && !checkingPublicId && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Check className="h-3 w-3 text-success" />
                        Public ID สามารถใช้ได้
                      </p>
                    )}
                    {!formData.public_id.trim() && (
                      <p className="text-sm text-muted-foreground">
                        จะใช้เป็น Public ID ของพาร์ทเนอร์
                      </p>
                    )}
                  </div>

                  <div className="rounded-lg border border-warning/50 bg-warning/10 p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                      <div className="text-sm space-y-1">
                        <p className="font-medium">รหัสผ่านชั่วคราวจะถูกสร้างอัตโนมัติ</p>
                        <p className="text-muted-foreground">
                          รหัสผ่าน 16 ตัวอักษร (ตัวพิมพ์เล็ก/ใหญ่/ตัวเลข/สัญลักษณ์) 
                          จะแสดงครั้งเดียวหลังจากสร้างบัญชีสำเร็จ
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Commission Policy */}
            {step === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle>นโยบายคอมมิชัน (ค่าตั้งต้น)</CardTitle>
                  <CardDescription>สามารถปรับแต่งรายเทนแนนต์ได้ในภายหลัง</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>ประเภทคอมมิชัน</Label>
                    <Select
                      value={formData.commission_type}
                      onValueChange={(v: any) => setFormData({ ...formData, commission_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="revenue_share">Revenue Share (แบ่งรายได้)</SelectItem>
                        <SelectItem value="bounty">Bounty (รางวัล)</SelectItem>
                        <SelectItem value="hybrid">Hybrid (ทั้งสอง)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(formData.commission_type === "revenue_share" || formData.commission_type === "hybrid") && (
                    <div className="space-y-2">
                      <Label>เปอร์เซ็นต์คอมมิชัน (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={formData.commission_percent}
                        onChange={(e) =>
                          setFormData({ ...formData, commission_percent: parseFloat(e.target.value) })
                        }
                      />
                    </div>
                  )}

                  {(formData.commission_type === "bounty" || formData.commission_type === "hybrid") && (
                    <div className="space-y-2">
                      <Label>จำนวน Bounty (บาท)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={formData.bounty_amount}
                        onChange={(e) =>
                          setFormData({ ...formData, bounty_amount: parseInt(e.target.value) })
                        }
                      />
                    </div>
                  )}

                  <div className="rounded-lg border p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>อนุญาตให้ปรับ % เอง</Label>
                        <p className="text-sm text-muted-foreground">
                          พาร์ทเนอร์สามารถปรับเปอร์เซ็นต์เองได้ภายในช่วงที่กำหนด
                        </p>
                      </div>
                      <Switch
                        checked={formData.allow_self_adjust}
                        onCheckedChange={(v) => setFormData({ ...formData, allow_self_adjust: v })}
                      />
                    </div>

                    {formData.allow_self_adjust && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>ต่ำสุด (%)</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={formData.adjust_min_percent}
                            onChange={(e) =>
                              setFormData({ ...formData, adjust_min_percent: parseFloat(e.target.value) })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>สูงสุด (%)</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={formData.adjust_max_percent}
                            onChange={(e) =>
                              setFormData({ ...formData, adjust_max_percent: parseFloat(e.target.value) })
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Link Tenants (Optional) */}
            {step === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle>ลิงก์ Owner Tenants (ตัวเลือก)</CardTitle>
                  <CardDescription>
                    เลือก Owner tenants ที่พาร์ทเนอร์จะดูแล (สามารถเพิ่มในภายหลังได้)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    คุณสมบัตินี้จะพร้อมใช้งานในภายหลัง - สามารถลิงก์ tenants ผ่านหน้าโปรไฟล์พาร์ทเนอร์ได้
                  </p>
                  <Badge variant="secondary" className="mt-2">
                    Coming Soon
                  </Badge>
                </CardContent>
              </Card>
            )}

            {/* Step 4: Summary */}
            {step === 4 && (
              <Card>
                <CardHeader>
                  <CardTitle>สรุปและยืนยัน</CardTitle>
                  <CardDescription>ตรวจสอบข้อมูลก่อนสร้างบัญชี</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">ชื่อแสดงผล:</span>
                      <span className="text-sm">{formData.display_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Public ID:</span>
                      <span className="text-sm font-mono">{formData.public_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">ประเภทคอมมิชัน:</span>
                      <Badge variant="secondary">
                        {formData.commission_type === "revenue_share"
                          ? "Revenue Share"
                          : formData.commission_type === "bounty"
                          ? "Bounty"
                          : "Hybrid"}
                      </Badge>
                    </div>
                    {(formData.commission_type === "revenue_share" || formData.commission_type === "hybrid") && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">เปอร์เซ็นต์:</span>
                        <span className="text-sm">{formData.commission_percent}%</span>
                      </div>
                    )}
                    {(formData.commission_type === "bounty" || formData.commission_type === "hybrid") && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Bounty:</span>
                        <span className="text-sm">฿{formData.bounty_amount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">ปรับ % เอง:</span>
                      <Badge variant={formData.allow_self_adjust ? "default" : "secondary"}>
                        {formData.allow_self_adjust ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                      </Badge>
                    </div>
                  </div>

                  <div className="rounded-lg border border-primary/50 bg-primary/10 p-4">
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <div className="text-sm space-y-1">
                        <p className="font-medium">พร้อมสร้างบัญชี</p>
                        <ul className="list-disc list-inside text-muted-foreground space-y-1">
                          <li>รหัสผ่านชั่วคราวจะถูกสร้างอัตโนมัติ</li>
                          <li>ลิงก์เชิญจะถูกสร้างและส่งทางอีเมล</li>
                          <li>พาร์ทเนอร์ต้องเปลี่ยนรหัสผ่านและเปิด MFA เมื่อเข้าสู่ระบบครั้งแรก</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => setStep(Math.max(1, step - 1))}
                disabled={step === 1 || createMutation.isPending}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                ย้อนกลับ
              </Button>

              {step < 4 ? (
                <Button
                  onClick={() => setStep(step + 1)}
                  disabled={!canProceed[step as keyof typeof canProceed]}
                >
                  ถัดไป
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      กำลังสร้าง...
                    </>
                  ) : (
                    <>
                      🔒 สร้างบัญชีพาร์ทเนอร์ (MFA)
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <TwoFactorChallenge 
        open={mfaOpen} 
        onOpenChange={setMfaOpen} 
        onSuccess={onSuccess}
        title="ยืนยันตัวตนก่อนสร้าง Partner"
        description="กรุณากรอกรหัสยืนยันตัวตนจากแอป Authenticator ของคุณ (Super Admin)"
        context="การสร้าง Partner เป็นการกระทำที่ละเอียดอ่อน - ระบบต้องยืนยันตัวตน Super Admin ก่อนดำเนินการ"
      />

      {credentials && (
        <CredentialsDialog
          open={showCredentials}
          onOpenChange={setShowCredentials}
          credentials={credentials}
        />
      )}
    </>
  );
}
