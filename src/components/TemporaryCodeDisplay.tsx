import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Copy, RefreshCw, XCircle, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunctionWithTenant } from "@/lib/supabaseFunctions";

interface TemporaryCodeDisplayProps {
  code: string;
  codeId: string;
  expiresAt: string;
  userId: string;
  tenantId?: string;
  purpose?: string;
  onRevoke?: () => void;
  onResend?: () => void;
}

export const TemporaryCodeDisplay = ({
  code,
  codeId,
  expiresAt,
  userId,
  tenantId,
  purpose = "onboard_invite",
  onRevoke,
  onResend,
}: TemporaryCodeDisplayProps) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Invitation code copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async () => {
    if (!confirm("Are you sure you want to revoke this invitation code?")) {
      return;
    }

    setIsRevoking(true);
    try {
      const { error } = await invokeFunctionWithTenant(
        "temporary-code-revoke",
        {
          body: { code_id: codeId },
        }
      );

      if (error) throw error;

      toast({
        title: "Code Revoked",
        description: "The invitation code has been revoked",
      });

      if (onRevoke) onRevoke();
    } catch (error) {
      console.error("Revoke error:", error);
      toast({
        title: "Error",
        description: "Failed to revoke code",
        variant: "destructive",
      });
    } finally {
      setIsRevoking(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      const { error } = await invokeFunctionWithTenant(
        "temporary-code-generate",
        {
          body: {
            user_id: userId,
            tenant_id: tenantId,
            purpose,
            issued_from_context: "resend",
          },
        }
      );

      if (error) throw error;

      toast({
        title: "Code Resent",
        description: "A new invitation code has been generated",
      });

      if (onResend) onResend();
    } catch (error) {
      console.error("Resend error:", error);
      toast({
        title: "Error",
        description: "Failed to generate new code",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  const expiryDate = new Date(expiresAt);
  const isExpired = expiryDate < new Date();
  const hoursRemaining = Math.max(
    0,
    Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60))
  );

  return (
    <Card className="p-4 bg-accent/50">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Invitation Code
          </label>
          <div className="flex items-center gap-2 mt-2">
            <code className="flex-1 px-4 py-3 text-2xl font-bold tracking-wider bg-background rounded border">
              {code}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              title="Copy code"
            >
              {copied ? (
                <Check className="w-4 h-4 text-success" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {isExpired ? (
              <span className="text-destructive font-medium">Expired</span>
            ) : (
              <>
                Expires in <span className="font-medium">{hoursRemaining}h</span>
              </>
            )}
          </span>
          <div className="flex gap-2">
            {!isExpired && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResend}
                  disabled={isResending}
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Resend
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRevoke}
                  disabled={isRevoking}
                >
                  <XCircle className="w-3 h-3 mr-1" />
                  Revoke
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            • User must use this code to set their password on first login
          </p>
          <p>• Code can only be used once</p>
          <p>• Valid for 72 hours from generation</p>
        </div>
      </div>
    </Card>
  );
};
