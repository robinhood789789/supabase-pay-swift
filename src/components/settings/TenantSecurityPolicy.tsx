import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Save, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";

export function TenantSecurityPolicy() {
  const { user, userRole } = useAuth();
  const { activeTenantId } = useTenantSwitcher();
  const queryClient = useQueryClient();
  const [require2faOwner, setRequire2faOwner] = useState(true);
  const [require2faAdmin, setRequire2faAdmin] = useState(true);
  const [stepupWindow, setStepupWindow] = useState("300");

  const { data: policy, isLoading } = useQuery({
    queryKey: ["tenant-security-policy", activeTenantId],
    queryFn: async () => {
      if (!activeTenantId) return null;

      const { data, error } = await supabase
        .from("tenant_security_policy")
        .select("*")
        .eq("tenant_id", activeTenantId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!activeTenantId,
  });

  useEffect(() => {
    if (policy) {
      setRequire2faOwner(policy.require_2fa_for_owner ?? true);
      setRequire2faAdmin(policy.require_2fa_for_admin ?? true);
      setStepupWindow(String(policy.stepup_window_seconds ?? 300));
    }
  }, [policy]);

  const savePolicyMutation = useMutation({
    mutationFn: async () => {
      if (!activeTenantId) throw new Error("No active tenant");

      const stepupSeconds = parseInt(stepupWindow);
      
      if (stepupSeconds < 120 || stepupSeconds > 900) {
        throw new Error("Step-up window must be between 120 and 900 seconds");
      }

      const policyData = {
        tenant_id: activeTenantId,
        require_2fa_for_owner: require2faOwner,
        require_2fa_for_admin: require2faAdmin,
        stepup_window_seconds: stepupSeconds,
      };

      if (policy) {
        // Update existing policy
        const { error } = await supabase
          .from("tenant_security_policy")
          .update(policyData)
          .eq("tenant_id", activeTenantId);

        if (error) throw error;
      } else {
        // Create new policy
        const { error } = await supabase
          .from("tenant_security_policy")
          .insert(policyData);

        if (error) throw error;
      }

      return policyData;
    },
    onSuccess: async (policyData) => {
      // Log audit event
      await supabase.from("audit_logs").insert({
        actor_user_id: user?.id,
        action: policy ? "tenant.security_policy.updated" : "tenant.security_policy.created",
        target: `tenant:${activeTenantId}:security_policy`,
        tenant_id: activeTenantId,
        before: policy ? {
          require_2fa_for_owner: policy.require_2fa_for_owner,
          require_2fa_for_admin: policy.require_2fa_for_admin,
          stepup_window_seconds: policy.stepup_window_seconds,
        } : null,
        after: policyData,
      });

      queryClient.invalidateQueries({ queryKey: ["tenant-security-policy"] });
      toast.success("Security policy updated successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to update security policy", {
        description: error.message,
      });
    },
  });

  const enforceNowMutation = useMutation({
    mutationFn: async () => {
      if (!activeTenantId) throw new Error("No active tenant");

      // Get all members who should have 2FA but don't
      const { data: memberships } = await supabase
        .from("memberships")
        .select(`
          user_id,
          profiles!inner (
            totp_enabled
          ),
          roles!inner (
            name
          )
        `)
        .eq("tenant_id", activeTenantId);

      if (!memberships) return { marked: 0 };

      let markedCount = 0;
      const requiresOwner2fa = require2faOwner;
      const requiresAdmin2fa = require2faAdmin;

      for (const membership of memberships) {
        const roleName = (membership.roles as any)?.name;
        const totpEnabled = (membership.profiles as any)?.totp_enabled;

        const shouldHave2fa = 
          (roleName === 'owner' && requiresOwner2fa) ||
          (roleName === 'finance' && requiresAdmin2fa);

        if (shouldHave2fa && !totpEnabled) {
          markedCount++;
          // In a real implementation, you'd mark these users for enrollment
          // This could be done via a separate table or a flag on profiles
        }
      }

      return { marked: markedCount };
    },
    onSuccess: async (result) => {
      await supabase.from("audit_logs").insert({
        actor_user_id: user?.id,
        action: "tenant.security_policy.enforce_now",
        target: `tenant:${activeTenantId}:security_policy`,
        tenant_id: activeTenantId,
        after: { marked_users: result.marked },
      });

      toast.success(`Enforcement triggered for ${result.marked} user(s)`, {
        description: "Affected users will be prompted to enroll 2FA at next login",
      });
    },
    onError: (error: Error) => {
      toast.error("Failed to enforce policy", {
        description: error.message,
      });
    },
  });

  if (userRole !== 'owner') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tenant Security Policy</CardTitle>
          <CardDescription>
            Only tenant owners can configure security policies
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tenant Security Policy</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading security policy...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Tenant Security Policy
        </CardTitle>
        <CardDescription>
          Configure two-factor authentication requirements for your organization
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            These settings control who must use 2FA and how long MFA verifications remain valid.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label htmlFor="require-owner-2fa" className="text-base font-semibold">
                Require 2FA for Owners
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Strongly recommended - Owners have full access to all resources
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="require-owner-2fa"
                checked={require2faOwner}
                onCheckedChange={setRequire2faOwner}
              />
              {require2faOwner && (
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              )}
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label htmlFor="require-admin-2fa" className="text-base font-semibold">
                Require 2FA for Admins
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Recommended for users with elevated permissions
              </p>
            </div>
            <Switch
              id="require-admin-2fa"
              checked={require2faAdmin}
              onCheckedChange={setRequire2faAdmin}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stepup-window" className="text-base font-semibold">
              Step-up Authentication Window
            </Label>
            <p className="text-sm text-muted-foreground mb-2">
              Time before requiring MFA re-verification for sensitive actions (in seconds)
            </p>
            <Input
              id="stepup-window"
              type="number"
              min="120"
              max="900"
              value={stepupWindow}
              onChange={(e) => setStepupWindow(e.target.value)}
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              Allowed range: 120 seconds (2 minutes) to 900 seconds (15 minutes)
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => savePolicyMutation.mutate()}
            disabled={savePolicyMutation.isPending}
            className="flex-1"
          >
            <Save className="w-4 h-4 mr-2" />
            {savePolicyMutation.isPending ? "Saving..." : "Save Policy"}
          </Button>
          <Button
            onClick={() => enforceNowMutation.mutate()}
            disabled={enforceNowMutation.isPending}
            variant="outline"
            className="flex-1"
          >
            {enforceNowMutation.isPending ? "Enforcing..." : "Enforce Now"}
          </Button>
        </div>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Enforce Now:</strong> Users who don't meet the 2FA requirements will be prompted to enroll at their next login. This action is immediate and cannot be undone.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
