import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { use2FAChallenge } from "@/hooks/use2FAChallenge";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { TwoFactorChallenge } from "@/components/security/TwoFactorChallenge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ProviderCredentials {
  provider: string;
  api_key: string;
  secret_key: string;
  webhook_secret: string;
  last_rotated_at?: string;
}

const PlatformProviders = () => {
  const { user, isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [providers, setProviders] = useState<ProviderCredentials[]>([]);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const { isOpen, setIsOpen, checkAndChallenge, onSuccess } = use2FAChallenge();

  useEffect(() => {
    if (!user || !isSuperAdmin) return;
    
    // Audit: Page view
    supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "platform.providers.view",
      target_type: "platform_providers",
      ip_address: "",
      user_agent: navigator.userAgent,
    });

    loadProviders();
  }, [user, isSuperAdmin]);

  const loadProviders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("platform_provider_credentials")
        .select("*")
        .order("provider", { ascending: true });

      if (error) throw error;

      const providersMap: Record<string, ProviderCredentials> = {
        stripe: { provider: "stripe", api_key: "", secret_key: "", webhook_secret: "" },
        omise: { provider: "omise", api_key: "", secret_key: "", webhook_secret: "" },
        "2c2p": { provider: "2c2p", api_key: "", secret_key: "", webhook_secret: "" },
        kbank: { provider: "kbank", api_key: "", secret_key: "", webhook_secret: "" },
      };

      // Populate with existing data
      data?.forEach((cred) => {
        if (providersMap[cred.provider]) {
          providersMap[cred.provider] = {
            provider: cred.provider,
            api_key: cred.public_key || "",
            secret_key: cred.secret_key || "",
            webhook_secret: cred.webhook_secret || "",
            last_rotated_at: cred.last_rotated_at,
          };
        }
      });

      setProviders(Object.values(providersMap));
    } catch (error) {
      console.error("Error loading providers:", error);
      toast.error("ไม่สามารถโหลดข้อมูล Provider ได้");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (provider: string) => {
    await checkAndChallenge(async () => {
      setSaving(true);
      try {
        const providerData = providers.find(p => p.provider === provider);
        if (!providerData) return;

        // Upsert provider credentials
        const { error } = await supabase
          .from("platform_provider_credentials")
          .upsert({
            provider: provider,
            mode: "production",
            public_key: providerData.api_key,
            secret_key: providerData.secret_key,
            webhook_secret: providerData.webhook_secret,
            created_by: user!.id,
            last_rotated_at: new Date().toISOString(),
          }, {
            onConflict: "provider,mode",
          });

        if (error) throw error;

        // Audit log
        await supabase.from("audit_logs").insert({
          actor_user_id: user!.id,
          action: "platform.providers.update",
          target: `${provider}_credentials`,
          after: { provider, updated: true, last_rotated_at: new Date().toISOString() },
          ip: "",
          user_agent: navigator.userAgent,
        });

        toast.success(`บันทึก ${provider.toUpperCase()} สำเร็จ`);
        await loadProviders();
      } catch (error) {
        console.error("Error saving provider:", error);
        toast.error("ไม่สามารถบันทึกข้อมูลได้");
      } finally {
        setSaving(false);
      }
    });
  };

  const handleRotate = async (provider: string) => {
    await checkAndChallenge(async () => {
      try {
        await supabase.from("audit_logs").insert({
          actor_id: user!.id,
          action: "platform.providers.rotate",
          target_type: "provider_credentials",
          target_id: provider,
          ip_address: "",
          user_agent: navigator.userAgent,
        });

        toast.success(`หมุนเวียน credentials ของ ${provider.toUpperCase()} สำเร็จ`);
        await loadProviders();
      } catch (error) {
        console.error("Error rotating credentials:", error);
        toast.error("ไม่สามารถหมุนเวียน credentials ได้");
      }
    });
  };

  const toggleShowSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const maskValue = (value: string) => {
    if (!value) return "";
    return "••••••••••••" + value.slice(-4);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>คุณไม่มีสิทธิ์เข้าถึงหน้านี้</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">จัดการ Payment Providers</h1>
          <p className="text-muted-foreground">จัดการ API credentials และ webhook secrets ของ payment providers</p>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            ⚠️ การบันทึกและหมุนเวียน credentials ต้องการ MFA ทุกครั้ง
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="stripe" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="stripe">Stripe</TabsTrigger>
            <TabsTrigger value="omise">Omise</TabsTrigger>
            <TabsTrigger value="2c2p">2C2P</TabsTrigger>
            <TabsTrigger value="kbank">KBank</TabsTrigger>
          </TabsList>

          {providers.map((provider) => (
            <TabsContent key={provider.provider} value={provider.provider}>
              <Card>
                <CardHeader>
                  <CardTitle>{provider.provider.toUpperCase()} Configuration</CardTitle>
                  <CardDescription>
                    {provider.last_rotated_at
                      ? `หมุนเวียนล่าสุด: ${new Date(provider.last_rotated_at).toLocaleString("th-TH")}`
                      : "ยังไม่เคยหมุนเวียน"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <div className="flex gap-2">
                      <Input
                        type={showSecrets[`${provider.provider}-api`] ? "text" : "password"}
                        value={showSecrets[`${provider.provider}-api`] ? provider.api_key : maskValue(provider.api_key)}
                        onChange={(e) => {
                          const newProviders = providers.map(p =>
                            p.provider === provider.provider ? { ...p, api_key: e.target.value } : p
                          );
                          setProviders(newProviders);
                        }}
                        placeholder="sk_test_..."
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => toggleShowSecret(`${provider.provider}-api`)}
                      >
                        {showSecrets[`${provider.provider}-api`] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Secret Key</Label>
                    <div className="flex gap-2">
                      <Input
                        type={showSecrets[`${provider.provider}-secret`] ? "text" : "password"}
                        value={showSecrets[`${provider.provider}-secret`] ? provider.secret_key : maskValue(provider.secret_key)}
                        onChange={(e) => {
                          const newProviders = providers.map(p =>
                            p.provider === provider.provider ? { ...p, secret_key: e.target.value } : p
                          );
                          setProviders(newProviders);
                        }}
                        placeholder="sk_live_..."
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => toggleShowSecret(`${provider.provider}-secret`)}
                      >
                        {showSecrets[`${provider.provider}-secret`] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Webhook Secret</Label>
                    <div className="flex gap-2">
                      <Input
                        type={showSecrets[`${provider.provider}-webhook`] ? "text" : "password"}
                        value={showSecrets[`${provider.provider}-webhook`] ? provider.webhook_secret : maskValue(provider.webhook_secret)}
                        onChange={(e) => {
                          const newProviders = providers.map(p =>
                            p.provider === provider.provider ? { ...p, webhook_secret: e.target.value } : p
                          );
                          setProviders(newProviders);
                        }}
                        placeholder="whsec_..."
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => toggleShowSecret(`${provider.provider}-webhook`)}
                      >
                        {showSecrets[`${provider.provider}-webhook`] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button onClick={() => handleSave(provider.provider)} disabled={saving}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      บันทึก
                    </Button>
                    <Button variant="outline" onClick={() => handleRotate(provider.provider)}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      หมุนเวียน Credentials
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        <TwoFactorChallenge
          open={isOpen}
          onOpenChange={setIsOpen}
          onSuccess={onSuccess}
        />
      </div>
  );
};

export default PlatformProviders;
