import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invokeFunctionWithTenant } from "@/lib/supabaseFunctions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Key, Copy, Trash2, Plus, AlertTriangle, Shield, Globe } from "lucide-react";
import { toast } from "sonner";
import { PermissionGate } from "../PermissionGate";
import { use2FAChallenge } from "@/hooks/use2FAChallenge";
import { TwoFactorChallenge } from "../security/TwoFactorChallenge";

interface CreateKeyForm {
  name: string;
  key_type: 'internal' | 'external';
  rate_limit_tier: string;
  ip_allowlist: string;
  notes: string;
}

export const ApiKeysManager = () => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState<CreateKeyForm>({
    name: "",
    key_type: "internal",
    rate_limit_tier: "standard",
    ip_allowlist: "",
    notes: ""
  });
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
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
        key_type: formData.key_type,
        rate_limit_tier: formData.rate_limit_tier,
        notes: formData.notes || null
      };

      // Parse IP allowlist if external key
      if (formData.key_type === 'external' && formData.ip_allowlist) {
        body.ip_allowlist = formData.ip_allowlist.split(',').map(ip => ip.trim()).filter(Boolean);
      }

      const { data, error } = await invokeFunctionWithTenant("api-keys-create", { body });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setNewApiKey(data.api_key.secret);
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API key created successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to create API key", {
        description: error.message,
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
        description: error.message,
      });
    },
  });

  const handleCreateKey = () => {
    if (!formData.name.trim()) {
      toast.error("Please enter a key name");
      return;
    }
    if (formData.key_type === 'external' && !formData.ip_allowlist.trim()) {
      toast.error("External keys require at least one IP address");
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
    setNewApiKey(null);
    setCreateDialogOpen(false);
    setFormData({
      name: "",
      key_type: "internal",
      rate_limit_tier: "standard",
      ip_allowlist: "",
      notes: ""
    });
  };

  const internalKeys = apiKeys?.filter(k => k.key_type === 'internal') || [];
  const externalKeys = apiKeys?.filter(k => k.key_type === 'external') || [];

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
                API Keys Management
              </CardTitle>
              <CardDescription>
                Manage Internal and External API keys for programmatic access
              </CardDescription>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Create Key
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create API Key</DialogTitle>
                  <DialogDescription>
                    Generate a new API key with customized access controls
                  </DialogDescription>
                </DialogHeader>
                
                {!newApiKey ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="keyName">Key Name *</Label>
                      <Input
                        id="keyName"
                        placeholder="Production API Key"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        disabled={createKeyMutation.isPending}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="keyType">Key Type *</Label>
                      <Select
                        value={formData.key_type}
                        onValueChange={(value: 'internal' | 'external') => 
                          setFormData({...formData, key_type: value})
                        }
                        disabled={createKeyMutation.isPending}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="internal">
                            <div className="flex items-center gap-2">
                              <Shield className="w-4 h-4" />
                              <div>
                                <div className="font-medium">Internal</div>
                                <div className="text-xs text-muted-foreground">
                                  For your own systems and applications
                                </div>
                              </div>
                            </div>
                          </SelectItem>
                          <SelectItem value="external">
                            <div className="flex items-center gap-2">
                              <Globe className="w-4 h-4" />
                              <div>
                                <div className="font-medium">External</div>
                                <div className="text-xs text-muted-foreground">
                                  For partners and third-party integrations
                                </div>
                              </div>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
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

                    {formData.key_type === 'external' && (
                      <div className="space-y-2">
                        <Label htmlFor="ipAllowlist">IP Allowlist (Required for External) *</Label>
                        <Textarea
                          id="ipAllowlist"
                          placeholder="192.168.1.1, 10.0.0.0/24"
                          value={formData.ip_allowlist}
                          onChange={(e) => setFormData({...formData, ip_allowlist: e.target.value})}
                          disabled={createKeyMutation.isPending}
                          className="font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                          Comma-separated IP addresses or CIDR ranges
                        </p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes (Optional)</Label>
                      <Textarea
                        id="notes"
                        placeholder="Description or usage notes..."
                        value={formData.notes}
                        onChange={(e) => setFormData({...formData, notes: e.target.value})}
                        disabled={createKeyMutation.isPending}
                      />
                    </div>

                    <Button
                      onClick={handleCreateKey}
                      disabled={createKeyMutation.isPending}
                      className="w-full"
                    >
                      {createKeyMutation.isPending ? "Creating..." : "Generate Key"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-warning/10 border border-warning rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-warning">Save this key now!</p>
                          <p className="text-muted-foreground mt-1">
                            You won't be able to see it again. Store it in a secure location.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Your API Key</Label>
                      <div className="flex gap-2">
                        <Input
                          value={newApiKey}
                          readOnly
                          className="font-mono text-sm"
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => handleCopyKey(newApiKey)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <Button onClick={handleCloseNewKeyDialog} className="w-full">
                      Done
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="internal" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="internal" className="gap-2">
                <Shield className="w-4 h-4" />
                Internal ({internalKeys.length})
              </TabsTrigger>
              <TabsTrigger value="external" className="gap-2">
                <Globe className="w-4 h-4" />
                External ({externalKeys.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="internal" className="mt-4">
              {isLoading ? (
                <p className="text-muted-foreground text-center py-8">Loading...</p>
              ) : internalKeys.length > 0 ? (
                <div className="space-y-3">
                  {internalKeys.map((key) => (
                    <ApiKeyCard key={key.id} apiKey={key} onRevoke={handleRevokeKey} />
                  ))}
                </div>
              ) : (
                <EmptyState type="internal" />
              )}
            </TabsContent>

            <TabsContent value="external" className="mt-4">
              {isLoading ? (
                <p className="text-muted-foreground text-center py-8">Loading...</p>
              ) : externalKeys.length > 0 ? (
                <div className="space-y-3">
                  {externalKeys.map((key) => (
                    <ApiKeyCard key={key.id} apiKey={key} onRevoke={handleRevokeKey} />
                  ))}
                </div>
              ) : (
                <EmptyState type="external" />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <TwoFactorChallenge open={isOpen} onOpenChange={setIsOpen} onSuccess={onSuccess} />
    </PermissionGate>
  );
};

const ApiKeyCard = ({ apiKey, onRevoke }: any) => {
  return (
    <div className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="font-medium">{apiKey.name}</p>
          <Badge variant={apiKey.key_type === 'internal' ? 'default' : 'secondary'} className="text-xs">
            {apiKey.key_type === 'internal' ? (
              <><Shield className="w-3 h-3 mr-1" /> Internal</>
            ) : (
              <><Globe className="w-3 h-3 mr-1" /> External</>
            )}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {apiKey.rate_limit_tier}
          </Badge>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-mono text-muted-foreground">{apiKey.prefix}</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Created {new Date(apiKey.created_at).toLocaleDateString()}</span>
            {apiKey.last_used_at && (
              <span>Last used {new Date(apiKey.last_used_at).toLocaleDateString()}</span>
            )}
          </div>
          {apiKey.notes && (
            <p className="text-xs text-muted-foreground mt-1">{apiKey.notes}</p>
          )}
          {apiKey.key_type === 'external' && apiKey.ip_allowlist?.length > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              <span className="font-medium">IP Allowlist:</span> {apiKey.ip_allowlist.join(', ')}
            </div>
          )}
        </div>
      </div>
      
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" className="gap-2">
            <Trash2 className="w-4 h-4" />
            Revoke
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently revoke "{apiKey.name}". Any applications using this key will no longer be able to authenticate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onRevoke(apiKey.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const EmptyState = ({ type }: { type: 'internal' | 'external' }) => (
  <div className="text-center py-8 text-muted-foreground">
    {type === 'internal' ? (
      <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
    ) : (
      <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
    )}
    <p>No {type} API keys created yet</p>
    <p className="text-sm mt-1">
      {type === 'internal' 
        ? 'Create an internal key for your own systems'
        : 'Create an external key for partner integrations'
      }
    </p>
  </div>
);
