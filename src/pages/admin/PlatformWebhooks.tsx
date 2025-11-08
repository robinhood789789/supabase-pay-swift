import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { use2FAChallenge } from "@/hooks/use2FAChallenge";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, RefreshCw, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { TwoFactorChallenge } from "@/components/security/TwoFactorChallenge";
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

interface WebhookEvent {
  id: string;
  event_type: string;
  tenant_id: string;
  tenant_name: string;
  payload: any;
  status: "pending" | "delivered" | "failed";
  retry_count: number;
  last_attempt_at?: string;
  next_retry_at?: string;
  created_at: string;
}

const PlatformWebhooks = () => {
  const { user, isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [webhooks, setWebhooks] = useState<WebhookEvent[]>([]);
  const [selectedWebhook, setSelectedWebhook] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { isOpen, setIsOpen, checkAndChallenge, onSuccess } = use2FAChallenge();
  const [pendingAction, setPendingAction] = useState<() => void>(() => {});

  useEffect(() => {
    if (!user || !isSuperAdmin) return;

    // Audit: Page view
    supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "platform.webhooks.view",
      target_type: "platform_webhooks",
      ip_address: "",
      user_agent: navigator.userAgent,
    });

    loadWebhooks();
  }, [user, isSuperAdmin]);

  const loadWebhooks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("webhook_dlq")
        .select(`
          id,
          event_id,
          event_type,
          tenant_id,
          tenant_name,
          payload,
          status,
          retry_count,
          max_retries,
          last_attempt_at,
          next_retry_at,
          created_at
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setWebhooks((data || []).map(w => ({
        ...w,
        status: (w.status as "pending" | "delivered" | "failed") || "pending",
      })));
    } catch (error) {
      console.error("Error loading webhooks:", error);
      toast.error("ไม่สามารถโหลด webhooks ได้");
    } finally {
      setLoading(false);
    }
  };

  const handleReplay = async (webhookId: string) => {
    const action = async () => {
      try {
        const { error } = await supabase.functions.invoke("webhooks-replay", {
          body: { webhookId },
        });

        if (error) throw error;

        toast.success("Webhook ถูก replay สำเร็จ");
        await loadWebhooks();
      } catch (error) {
        console.error("Error replaying webhook:", error);
        toast.error("ไม่สามารถ replay webhook ได้");
      }
    };

    setPendingAction(() => action);
    await checkAndChallenge(action);
  };

  const handleDelete = async (webhookId: string) => {
    const action = async () => {
      try {
        await supabase.from("audit_logs").insert({
          actor_id: user!.id,
          action: "platform.webhooks.delete",
          target_type: "webhook_event",
          target_id: webhookId,
          ip_address: "",
          user_agent: navigator.userAgent,
        });

        setWebhooks(webhooks.filter((w) => w.id !== webhookId));
        toast.success("ลบ webhook สำเร็จ");
      } catch (error) {
        console.error("Error deleting webhook:", error);
        toast.error("ไม่สามารถลบ webhook ได้");
      } finally {
        setShowDeleteDialog(false);
        setSelectedWebhook(null);
      }
    };

    setPendingAction(() => action);
    setShowDeleteDialog(false);
    await checkAndChallenge(action);
  };

  const dlqCount = webhooks.filter((w) => w.status === "failed").length;

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
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Webhook Management (Platform)</h1>
          <p className="text-muted-foreground">จัดการ webhook events ที่ failed พร้อม DLQ และ replay</p>
        </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          ⚠️ การ replay และลบ webhook ต้องการ MFA ทุกครั้ง
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Webhooks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{webhooks.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>DLQ Count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{dlqCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delivered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {webhooks.filter((w) => w.status === "delivered").length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Failed Webhooks (DLQ)</CardTitle>
          <CardDescription>Webhooks ที่ failed และรอการ replay</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Webhook ID</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Retry Count</TableHead>
                <TableHead>Last Attempt</TableHead>
                <TableHead>Next Retry</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhooks.filter((w) => w.status === "failed").length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    ไม่มี failed webhooks
                  </TableCell>
                </TableRow>
              ) : (
                webhooks
                  .filter((w) => w.status === "failed")
                  .map((webhook) => (
                    <TableRow key={webhook.id}>
                      <TableCell className="font-mono text-sm">{webhook.id}</TableCell>
                      <TableCell>{webhook.event_type}</TableCell>
                      <TableCell>{webhook.tenant_name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{webhook.retry_count}/5</Badge>
                      </TableCell>
                      <TableCell>
                        {webhook.last_attempt_at
                          ? new Date(webhook.last_attempt_at).toLocaleString("th-TH")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {webhook.next_retry_at
                          ? new Date(webhook.next_retry_at).toLocaleString("th-TH")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReplay(webhook.id)}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Replay
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setSelectedWebhook(webhook.id);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ Webhook</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ว่าต้องการลบ webhook นี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={() => selectedWebhook && handleDelete(selectedWebhook)}>
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TwoFactorChallenge
        open={isOpen}
        onOpenChange={setIsOpen}
        onSuccess={() => {
          onSuccess();
          if (pendingAction) pendingAction();
        }}
      />
      </div>
    </DashboardLayout>
  );
};

export default PlatformWebhooks;
