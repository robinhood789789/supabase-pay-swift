import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invokeFunctionWithTenant } from "@/lib/supabaseFunctions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Webhook, Plus, Trash2, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { use2FAChallenge } from "@/hooks/use2FAChallenge";
import { TwoFactorChallenge } from "../security/TwoFactorChallenge";
import { WebhookTestDialog } from "./WebhookTestDialog";

export const WebhooksManager = () => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<{ id: string; url: string; events: string[] } | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookDescription, setWebhookDescription] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    "payment.succeeded",
    "payment.failed",
    "refund.created",
  ]);
  const queryClient = useQueryClient();
  const { isOpen, setIsOpen, checkAndChallenge, onSuccess } = use2FAChallenge();
  const { hasPermission } = usePermissions();
  const { tenantId } = useAuth();

  const { data: webhooks, isLoading } = useQuery({
    queryKey: ["webhooks"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("webhooks")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const createWebhookMutation = useMutation({
    mutationFn: async ({ url, description, events }: { url: string; description: string; events: string[] }) => {
      if (!tenantId) {
        throw new Error("Tenant ID is required");
      }

      // Generate webhook secret using browser crypto
      const secret = crypto.randomUUID();
      
      const { data, error } = await (supabase as any)
        .from("webhooks")
        .insert({
          tenant_id: tenantId,
          url: url.trim(),
          description: description.trim(),
          events: events,
          secret: secret,
          enabled: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      setCreateDialogOpen(false);
      setWebhookUrl("");
      setWebhookDescription("");
      setSelectedEvents(["payment.succeeded", "payment.failed", "refund.created"]);
      toast.success("Webhook created successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to create webhook", {
        description: error.message,
      });
    },
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: async (webhookId: string) => {
      const { error } = await (supabase as any)
        .from("webhooks")
        .delete()
        .eq("id", webhookId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success("Webhook deleted successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete webhook", {
        description: error.message,
      });
    },
  });

  const toggleWebhookMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await (supabase as any)
        .from("webhooks")
        .update({ enabled })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success("Webhook updated");
    },
    onError: (error: Error) => {
      toast.error("Failed to update webhook", {
        description: error.message,
      });
    },
  });

  const testWebhookMutation = useMutation({
    mutationFn: async (webhookId: string) => {
      const { data, error } = await supabase.functions.invoke('webhooks-send-test', {
        body: { webhook_id: webhookId },
      });

      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.message || 'Test failed');
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Test webhook sent successfully', {
        description: `Status: ${data.status}`,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to send test webhook', {
        description: error.message,
      });
    },
  });

  const handleCreateWebhook = () => {
    if (!webhookUrl.trim()) {
      toast.error("Please enter a webhook URL");
      return;
    }

    if (!webhookDescription.trim()) {
      toast.error("Please enter a description");
      return;
    }

    if (selectedEvents.length === 0) {
      toast.error("Please select at least one event");
      return;
    }

    try {
      new URL(webhookUrl);
    } catch {
      toast.error("Please enter a valid URL");
      return;
    }

    checkAndChallenge(() => createWebhookMutation.mutate({ 
      url: webhookUrl, 
      description: webhookDescription,
      events: selectedEvents 
    }));
  };

  const handleTestWebhook = (webhook: { id: string; url: string; events: string[] }) => {
    checkAndChallenge(() => {
      setSelectedWebhook(webhook);
      setTestDialogOpen(true);
    });
  };

  const handleDeleteWebhook = (webhookId: string) => {
    checkAndChallenge(() => deleteWebhookMutation.mutate(webhookId));
  };

  const canManage = hasPermission("webhooks.manage");
  const canView = hasPermission("webhooks.view");
  const canTest = hasPermission("webhooks.test");

  return (
    <>
      <div className="space-y-6">
        {/* Create Webhook Form */}
        <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                สร้าง Webhook Endpoint ใหม่
              </CardTitle>
              <CardDescription>
                กำหนด URL endpoint ที่ต้องการรับการแจ้งเตือน payment events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="webhookDescription">ชื่อ / คำอธิบาย</Label>
                  <Input
                    id="webhookDescription"
                    type="text"
                    placeholder="Production Payment Webhook"
                    value={webhookDescription}
                    onChange={(e) => setWebhookDescription(e.target.value)}
                    disabled={createWebhookMutation.isPending}
                  />
                  <p className="text-xs text-muted-foreground">
                    ระบุชื่อหรือคำอธิบายเพื่อระบุจุดประสงค์ของ webhook นี้
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="webhookUrl">Webhook URL</Label>
                  <Input
                    id="webhookUrl"
                    type="url"
                    placeholder="https://example.com/api/webhooks/payment"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    disabled={createWebhookMutation.isPending}
                  />
                  <p className="text-xs text-muted-foreground">
                    URL ต้องเป็น HTTPS และสามารถรับ POST request ได้
                  </p>
                </div>

                <div className="space-y-3">
                  <Label>Events to Listen</Label>
                  <div className="space-y-2 border rounded-lg p-3 max-h-64 overflow-y-auto">
                    {[
                      { value: "payment.succeeded", label: "Payment Succeeded", description: "เมื่อการชำระเงินสำเร็จ" },
                      { value: "payment.failed", label: "Payment Failed", description: "เมื่อการชำระเงินล้มเหลว" },
                      { value: "payment.pending", label: "Payment Pending", description: "เมื่อการชำระเงินรอดำเนินการ" },
                      { value: "refund.created", label: "Refund Created", description: "เมื่อสร้างคำขอคืนเงิน" },
                      { value: "refund.succeeded", label: "Refund Succeeded", description: "เมื่อคืนเงินสำเร็จ" },
                      { value: "refund.failed", label: "Refund Failed", description: "เมื่อคืนเงินล้มเหลว" },
                      { value: "dispute.created", label: "Dispute Created", description: "เมื่อมีข้อพิพาท" },
                      { value: "settlement.completed", label: "Settlement Completed", description: "เมื่อการตัดจ่ายเสร็จสิ้น" },
                    ].map((event) => (
                      <div key={event.value} className="flex items-start space-x-3 py-2">
                        <Checkbox
                          id={event.value}
                          checked={selectedEvents.includes(event.value)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedEvents([...selectedEvents, event.value]);
                            } else {
                              setSelectedEvents(selectedEvents.filter((e) => e !== event.value));
                            }
                          }}
                          disabled={createWebhookMutation.isPending}
                        />
                        <div className="flex-1">
                          <Label htmlFor={event.value} className="cursor-pointer font-medium">
                            {event.label}
                          </Label>
                          <p className="text-xs text-muted-foreground">{event.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    เลือก events ที่ต้องการรับการแจ้งเตือน (ต้องเลือกอย่างน้อย 1 event)
                  </p>
                </div>

                <div className="border-t pt-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Webhook Security</Label>
                    <div className="bg-muted/50 p-3 rounded-lg space-y-1">
                      <p className="text-xs text-muted-foreground">
                        • Webhook secret จะถูกสร้างอัตโนมัติ
                      </p>
                      <p className="text-xs text-muted-foreground">
                        • ใช้ secret เพื่อ verify webhook signatures
                      </p>
                      <p className="text-xs text-muted-foreground">
                        • Header: <code className="text-xs bg-background px-1 py-0.5 rounded">X-Webhook-Signature</code>
                      </p>
                    </div>
                  </div>
                </div>
                
                <Button
                  onClick={handleCreateWebhook}
                  disabled={createWebhookMutation.isPending}
                  className="w-full"
                >
                  {createWebhookMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      กำลังสร้าง...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      สร้าง Webhook
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

        {/* Existing Webhooks List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="w-5 h-5" />
              Webhooks ที่มีอยู่
            </CardTitle>
            <CardDescription>
              จัดการ webhook endpoints ที่สร้างไว้แล้ว
            </CardDescription>
          </CardHeader>
          <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : webhooks && webhooks.length > 0 ? (
            <div className="space-y-3">
              {webhooks.map((webhook) => (
                <div
                  key={webhook.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold">{webhook.description || "Webhook Endpoint"}</p>
                      <Badge variant={webhook.enabled ? "default" : "secondary"}>
                        {webhook.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    <p className="text-sm break-all text-muted-foreground">{webhook.url}</p>
                    {webhook.events && webhook.events.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {webhook.events.map((event: string) => (
                          <Badge key={event} variant="outline" className="text-xs">
                            {event}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <p className="text-xs text-muted-foreground">
                        Created {new Date(webhook.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-xs font-mono text-muted-foreground">
                        Secret: {webhook.secret.substring(0, 8)}...
                      </p>
                    </div>
                  </div>
                  
                   <div className="flex items-center gap-2 ml-4">
                    {canManage && (
                      <Switch
                        checked={webhook.enabled}
                        onCheckedChange={(enabled) =>
                          toggleWebhookMutation.mutate({ id: webhook.id, enabled })
                        }
                      />
                    )}
                    
                    {(canTest || canManage) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestWebhook({
                          id: webhook.id,
                          url: webhook.url,
                          events: webhook.events || []
                        })}
                        disabled={!webhook.enabled}
                        className="gap-2"
                      >
                        <Send className="w-4 h-4" />
                        ทดสอบ
                      </Button>
                    )}
                    
                    {canManage && (
                      <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Webhook?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this webhook endpoint. You will no longer receive notifications at this URL.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteWebhook(webhook.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Webhook className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>ยังไม่มี webhook endpoints</p>
              {canManage && (
                <p className="text-sm mt-1">เพิ่ม webhook endpoint เพื่อรับการแจ้งเตือน events</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
      
      <TwoFactorChallenge open={isOpen} onOpenChange={setIsOpen} onSuccess={onSuccess} />
      {selectedWebhook && (
        <WebhookTestDialog
          open={testDialogOpen}
          onOpenChange={setTestDialogOpen}
          webhookId={selectedWebhook.id}
          webhookUrl={selectedWebhook.url}
          webhookEvents={selectedWebhook.events}
        />
      )}
    </>
  );
};
