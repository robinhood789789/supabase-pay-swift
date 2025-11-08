import { useState } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { useMfaGuard } from "@/hooks/useMfaGuard";
import { use2FAChallenge } from "@/hooks/use2FAChallenge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Link2, 
  RefreshCw, 
  Download, 
  Key, 
  Webhook,
  AlertCircle,
  CheckCircle,
  Clock
} from "lucide-react";
import { MyActivityPanel } from "./MyActivityPanel";
import { TwoFactorChallenge } from "./security/TwoFactorChallenge";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const AdminWorkbench = () => {
  const { hasPermission, permissions, isLoading: permsLoading } = usePermissions();
  const { isLoading: mfaLoading } = useMfaGuard({ required: false });
  const { isOpen, setIsOpen, checkAndChallenge, onSuccess } = use2FAChallenge();

  const actions = [
    {
      id: "create-payment-link",
      permission: "payments.create",
      icon: Link2,
      label: "Create Payment Link",
      description: "Generate a new payment link",
      variant: "default" as const,
      requiresMFA: true,
    },
    {
      id: "create-refund",
      permission: "refunds.create",
      icon: RefreshCw,
      label: "Process Refund",
      description: "Issue a refund to a customer",
      variant: "secondary" as const,
      requiresMFA: true,
    },
    {
      id: "export-csv",
      permission: "reports.export",
      icon: Download,
      label: "Export Report",
      description: "Download transaction data",
      variant: "outline" as const,
      requiresMFA: true,
    },
    {
      id: "manage-api-keys",
      permission: "api_keys.manage",
      icon: Key,
      label: "Manage API Keys",
      description: "Create or revoke API keys",
      variant: "outline" as const,
      requiresMFA: true,
    },
    {
      id: "manage-webhooks",
      permission: "webhooks.manage",
      icon: Webhook,
      label: "Manage Webhooks",
      description: "Configure webhook endpoints",
      variant: "outline" as const,
      requiresMFA: true,
    },
  ];

  const handleAction = (actionId: string, requiresMFA: boolean) => {
    const action = () => {
      toast.info("Action triggered", {
        description: `${actionId} - Implementation pending`,
      });
    };

    if (requiresMFA) {
      checkAndChallenge(action);
    } else {
      action();
    }
  };

  const canPerformAction = (permission: string) => {
    return hasPermission(permission);
  };

  if (permsLoading || mfaLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-8 text-muted-foreground">Loading workspace...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Admin Workbench</h1>
        <p className="text-muted-foreground">Quick access to your allowed actions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Permissions Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Your Permissions</CardTitle>
              <CardDescription>
                You have {permissions.length} permission(s) in this workspace
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {permissions.slice(0, 10).map((perm) => (
                  <Badge key={perm} variant="secondary">
                    {perm}
                  </Badge>
                ))}
                {permissions.length > 10 && (
                  <Badge variant="outline">+{permissions.length - 10} more</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Common tasks based on your permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {actions.map((action) => {
                  const canPerform = canPerformAction(action.permission);
                  const ActionIcon = action.icon;
                  
                  return (
                    <TooltipProvider key={action.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <Button
                              variant={action.variant}
                              className="w-full h-auto flex flex-col items-start p-4 gap-2"
                              disabled={!canPerform}
                              onClick={() => handleAction(action.id, action.requiresMFA)}
                            >
                              <div className="flex items-center justify-between w-full">
                                <ActionIcon className="w-5 h-5" />
                                {canPerform ? (
                                  <CheckCircle className="w-4 h-4 text-success" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 text-muted-foreground" />
                                )}
                              </div>
                              <div className="text-left">
                                <p className="font-semibold">{action.label}</p>
                                <p className="text-xs text-muted-foreground font-normal">
                                  {action.description}
                                </p>
                              </div>
                              {action.requiresMFA && canPerform && (
                                <Badge variant="outline" className="text-xs">
                                  <Clock className="w-3 h-3 mr-1" />
                                  Requires MFA
                                </Badge>
                              )}
                            </Button>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {canPerform ? (
                            <p>Click to perform this action</p>
                          ) : (
                            <p>You don't have permission: {action.permission}</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* My Activity Sidebar */}
        <div className="lg:col-span-1">
          <MyActivityPanel />
        </div>
      </div>

      <TwoFactorChallenge open={isOpen} onOpenChange={setIsOpen} onSuccess={onSuccess} />
    </div>
  );
};
