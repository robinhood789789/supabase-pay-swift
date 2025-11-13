import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invokeFunctionWithTenant } from "@/lib/supabaseFunctions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Key, Copy, Trash2, Plus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { PermissionGate } from "../PermissionGate";
import { use2FAChallenge } from "@/hooks/use2FAChallenge";
import { TwoFactorChallenge } from "../security/TwoFactorChallenge";
import { sanitizeClientError } from "@/lib/security/errorHandling";

interface CreateKeyForm {
  name: string;
  description: string;
  rate_limit_tier: string;
  ip_allowlist: string;
  expires_in_days: number | null;
}

interface ApiCredentials {
  api_key: string;
  api_secret: string;
}

export const ApiKeysManager = () => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState<CreateKeyForm>({
    name: "",
    description: "",
    rate_limit_tier: "standard",
    ip_allowlist: "",
    expires_in_days: null
  });
  const [newCredentials, setNewCredentials] = useState<ApiCredentials | null>(null);
  const queryClient = useQueryClient();
  const { isOpen, setIsOpen, checkAndChallenge, onSuccess } = use2FAChallenge();

  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_keys")
        .select("*")
        .is("revoked_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const createKeyMutation = useMutation({
    mutationFn: async (formData: CreateKeyForm) => {
      const body: any = { 
        name: formData.name,
        description: formData.description || null,
        rate_limit_tier: formData.rate_limit_tier,
        expires_in_days: formData.expires_in_days
      };

      // Parse IP allowlist
      if (formData.ip_allowlist) {
        body.ip_allowlist = formData.ip_allowlist.split(',').map(ip => ip.trim()).filter(Boolean);
      }

      const { data, error } = await invokeFunctionWithTenant("api-credentials-create", { body });

      if (error) {
        console.error('[API Keys] Edge function error:', error);
        throw new Error(error.message);
      }
      
      if (data.error) {
        console.error('[API Keys] API error response:', data);
        // Check for MFA-related errors
        if (data.code === 'MFA_ENROLL_REQUIRED') {
          throw new Error('กรุณาตั้งค่า Two-Factor Authentication ก่อนสร้าง API Credentials (Settings > Security)');
        }
        if (data.code === 'MFA_CHALLENGE_REQUIRED') {
          throw new Error('กรุณายืนยันตัวตนด้วย 2FA อีกครั้ง');
        }
        throw new Error(data.error);
      }
      
      return data;
    },
    onSuccess: (data) => {
      setNewCredentials({
        api_key: data.credentials.api_key,
        api_secret: data.credentials.api_secret
      });
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API credentials created successfully");
    },
    onError: (error: Error) => {
      console.error('[API Keys] Mutation error:', error);
      toast.error("Failed to create API key", {
        description: sanitizeClientError(error),
      });
    },
  });

  const revokeKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const { data, error } = await invokeFunctionWithTenant("api-keys-revoke", {
        body: { api_key_id: keyId },
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API key revoked successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to revoke API key", {
        description: sanitizeClientError(error),
      });
    },
  });

  const handleCreateKey = () => {
    if (!formData.name.trim()) {
      toast.error("กรุณาระบุชื่อ API Credentials");
      return;
    }
    checkAndChallenge(() => createKeyMutation.mutate(formData));
  };

  const handleRevokeKey = (keyId: string) => {
    checkAndChallenge(() => revokeKeyMutation.mutate(keyId));
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("API key copied to clipboard");
  };

  const handleCloseNewKeyDialog = () => {
    setNewCredentials(null);
    setCreateDialogOpen(false);
    setFormData({
      name: "",
      description: "",
      rate_limit_tier: "standard",
      ip_allowlist: "",
      expires_in_days: null
    });
  };

  const allCredentials = apiKeys || [];

  return (
    <PermissionGate
      permissions={["api_keys.manage", "api_keys.view"]}
      requireAll={false}
      fallback={
        <Card>
          <CardHeader>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>
              You don't have permission to manage API keys
            </CardDescription>
          </CardHeader>
        </Card>
      }
    >
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                จัดการ API Credentials
              </CardTitle>
              <CardDescription>
                สร้างและจัดการ API Key และ API Secret สำหรับเข้าถึงระบบแบบโปรแกรม
              </CardDescription>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  สร้าง Credentials
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>สร้าง API Credentials</DialogTitle>
                  <DialogDescription>
                    สร้าง API Key และ API Secret สำหรับเข้าถึงระบบแบบโปรแกรม
                  </DialogDescription>
                </DialogHeader>
                
                {!newCredentials ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="keyName">ชื่อ *</Label>
                      <Input
                        id="keyName"
                        placeholder="Production API Credentials"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        disabled={createKeyMutation.isPending}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">คำอธิบาย</Label>
                      <Textarea
                        id="description"
                        placeholder="ระบุวัตถุประสงค์การใช้งาน..."
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        disabled={createKeyMutation.isPending}
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="rateLimitTier">Rate Limit Tier</Label>
                      <Select
                        value={formData.rate_limit_tier}
                        onValueChange={(value) => setFormData({...formData, rate_limit_tier: value})}
                        disabled={createKeyMutation.isPending}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="basic">Basic (100 req/min)</SelectItem>
                          <SelectItem value="standard">Standard (500 req/min)</SelectItem>
                          <SelectItem value="premium">Premium (2000 req/min)</SelectItem>
                          <SelectItem value="enterprise">Enterprise (10000 req/min)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ipAllowlist">IP Allowlist (ไม่บังคับ)</Label>
                      <Textarea
                        id="ipAllowlist"
                        placeholder="192.168.1.1, 10.0.0.0/24"
                        value={formData.ip_allowlist}
                        onChange={(e) => setFormData({...formData, ip_allowlist: e.target.value})}
                        disabled={createKeyMutation.isPending}
                        className="font-mono text-sm"
                        rows={2}
                      />
                      <p className="text-xs text-muted-foreground">
                        ระบุ IP ที่อนุญาตให้เข้าถึง (คั่นด้วยจุลภาค)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="expiration"
                          checked={formData.expires_in_days !== null}
                          onCheckedChange={(checked) => 
                            setFormData({...formData, expires_in_days: checked ? 365 : null})
                          }
                        />
                        <Label htmlFor="expiration">กำหนดวันหมดอายุ</Label>
                      </div>
                      {formData.expires_in_days !== null && (
                        <Input
                          type="number"
                          min="1"
                          max="3650"
                          placeholder="365"
                          value={formData.expires_in_days || ''}
                          onChange={(e) => setFormData({
                            ...formData, 
                            expires_in_days: parseInt(e.target.value) || null
                          })}
                          disabled={createKeyMutation.isPending}
                        />
                      )}
                      <p className="text-xs text-muted-foreground">
                        จำนวนวันก่อนหมดอายุ (ไม่ระบุ = ไม่หมดอายุ)
                      </p>
                    </div>

                    <Button
                      onClick={handleCreateKey}
                      disabled={createKeyMutation.isPending}
                      className="w-full"
                    >
                      {createKeyMutation.isPending ? "กำลังสร้าง..." : "สร้าง Credentials"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-warning/10 border border-warning rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-warning">บันทึกข้อมูลนี้เดี๋ยวนี้!</p>
                          <p className="text-muted-foreground mt-1">
                            คุณจะไม่สามารถดู API Secret ได้อีกครั้ง กรุณาเก็บไว้ในที่ปลอดภัย
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>API Key (Public)</Label>
                      <div className="flex gap-2">
                        <Input
                          value={newCredentials.api_key}
                          readOnly
                          className="font-mono text-sm"
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => handleCopyKey(newCredentials.api_key)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        ใช้เป็น identifier สำหรับ API requests
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>API Secret (Private)</Label>
                      <div className="flex gap-2">
                        <Input
                          value={newCredentials.api_secret}
                          readOnly
                          className="font-mono text-sm"
                          type="password"
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => handleCopyKey(newCredentials.api_secret)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        ใช้สำหรับ authenticate API requests (เก็บเป็นความลับ)
                      </p>
                    </div>
                    
                    <Button onClick={handleCloseNewKeyDialog} className="w-full">
                      เสร็จสิ้น
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">กำลังโหลด...</p>
          ) : allCredentials.length > 0 ? (
            <div className="space-y-3">
              {allCredentials.map((credential) => (
                <ApiCredentialCard key={credential.id} credential={credential} onRevoke={handleRevokeKey} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Key className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">ยังไม่มี API Credentials</h3>
              <p className="text-sm text-muted-foreground mb-4">
                สร้าง API Key และ Secret เพื่อเข้าถึงระบบแบบโปรแกรม
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      <TwoFactorChallenge open={isOpen} onOpenChange={setIsOpen} onSuccess={onSuccess} />
    </PermissionGate>
  );
};

const ApiCredentialCard = ({ credential, onRevoke }: any) => {
  return (
    <div className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="font-medium">{credential.name}</p>
          <Badge variant="outline" className="text-xs">
            {credential.rate_limit_tier}
          </Badge>
          {credential.expires_at && (
            <Badge variant="secondary" className="text-xs">
              หมดอายุ {new Date(credential.expires_at).toLocaleDateString('th-TH')}
            </Badge>
          )}
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">API Key:</span>
            <p className="text-sm font-mono text-foreground">{credential.prefix}</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>สร้างเมื่อ {new Date(credential.created_at).toLocaleDateString('th-TH')}</span>
            {credential.last_used_at && (
              <span>ใช้ล่าสุด {new Date(credential.last_used_at).toLocaleDateString('th-TH')}</span>
            )}
          </div>
          {credential.notes && (
            <p className="text-xs text-muted-foreground mt-1">{credential.notes}</p>
          )}
          {credential.ip_allowlist?.length > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              <span className="font-medium">IP Allowlist:</span> {credential.ip_allowlist.join(', ')}
            </div>
          )}
        </div>
      </div>
      
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" className="gap-2">
            <Trash2 className="w-4 h-4" />
            เพิกถอน
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>เพิกถอน API Credentials?</AlertDialogTitle>
            <AlertDialogDescription>
              การกระทำนี้จะเพิกถอน "{credential.name}" อย่างถาวร แอปพลิเคชันที่ใช้ credentials นี้จะไม่สามารถยืนยันตัวตนได้อีกต่อไป
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onRevoke(credential.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              เพิกถอน
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

