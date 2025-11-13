import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Send, CheckCircle2, XCircle, Clock, Code, Settings2 } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

interface WebhookTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhookId: string;
  webhookUrl: string;
  webhookEvents: string[];
}

interface TestResponse {
  success: boolean;
  status: number;
  response: string;
  message: string;
  timestamp?: string;
  duration?: number;
  requestPayload?: any;
  requestHeaders?: Record<string, string>;
}

const EVENT_OPTIONS = [
  { value: "payment.succeeded", label: "Payment Succeeded", description: "เมื่อการชำระเงินสำเร็จ" },
  { value: "payment.failed", label: "Payment Failed", description: "เมื่อการชำระเงินล้มเหลว" },
  { value: "payment.pending", label: "Payment Pending", description: "เมื่อการชำระเงินรอดำเนินการ" },
  { value: "refund.created", label: "Refund Created", description: "เมื่อสร้างคำขอคืนเงิน" },
  { value: "refund.succeeded", label: "Refund Succeeded", description: "เมื่อคืนเงินสำเร็จ" },
  { value: "refund.failed", label: "Refund Failed", description: "เมื่อคืนเงินล้มเหลว" },
  { value: "dispute.created", label: "Dispute Created", description: "เมื่อมีข้อพิพาท" },
  { value: "settlement.completed", label: "Settlement Completed", description: "เมื่อการตัดจ่ายเสร็จสิ้น" },
  { value: "webhook.test", label: "Webhook Test", description: "สำหรับทดสอบ webhook" },
];

// Sample payloads for each event type
const SAMPLE_PAYLOADS: Record<string, any> = {
  "payment.succeeded": {
    event: "payment.succeeded",
    id: "pay_test_123456",
    amount: 1000.00,
    currency: "THB",
    status: "succeeded",
    customer: {
      id: "cus_test_123",
      email: "customer@example.com"
    },
    created_at: new Date().toISOString()
  },
  "payment.failed": {
    event: "payment.failed",
    id: "pay_test_123456",
    amount: 1000.00,
    currency: "THB",
    status: "failed",
    error: {
      code: "card_declined",
      message: "The card was declined"
    },
    created_at: new Date().toISOString()
  },
  "payment.pending": {
    event: "payment.pending",
    id: "pay_test_123456",
    amount: 1000.00,
    currency: "THB",
    status: "pending",
    created_at: new Date().toISOString()
  },
  "refund.created": {
    event: "refund.created",
    id: "ref_test_123456",
    payment_id: "pay_test_123456",
    amount: 1000.00,
    currency: "THB",
    status: "pending",
    reason: "requested_by_customer",
    created_at: new Date().toISOString()
  },
  "webhook.test": {
    event: "webhook.test",
    id: "test_" + Date.now(),
    message: "This is a test webhook event",
    timestamp: new Date().toISOString()
  }
};

export const WebhookTestDialog = ({
  open,
  onOpenChange,
  webhookId,
  webhookUrl,
  webhookEvents,
}: WebhookTestDialogProps) => {
  const [selectedEvent, setSelectedEvent] = useState<string>("webhook.test");
  const [customPayload, setCustomPayload] = useState<string>("");
  const [useCustomPayload, setUseCustomPayload] = useState(false);
  const [testResult, setTestResult] = useState<TestResponse | null>(null);

  // Update custom payload when event changes
  const handleEventChange = (eventType: string) => {
    setSelectedEvent(eventType);
    const samplePayload = SAMPLE_PAYLOADS[eventType] || SAMPLE_PAYLOADS["webhook.test"];
    setCustomPayload(JSON.stringify(samplePayload, null, 2));
  };

  const testWebhookMutation = useMutation({
    mutationFn: async () => {
      const startTime = Date.now();
      
      let payload: any = {
        webhook_id: webhookId,
        event_type: selectedEvent
      };

      // If using custom payload, parse and send it
      if (useCustomPayload && customPayload.trim()) {
        try {
          const parsedPayload = JSON.parse(customPayload);
          payload = {
            ...payload,
            custom_payload: parsedPayload
          };
        } catch (e) {
          throw new Error("Invalid JSON payload: " + (e as Error).message);
        }
      }

      const { data, error } = await supabase.functions.invoke('webhooks-send-test', {
        body: payload,
      });

      const duration = Date.now() - startTime;

      if (error) throw new Error(error.message);
      if (!data.success && !data.status) throw new Error(data.message || 'Test failed');
      
      return {
        ...data,
        duration,
        timestamp: new Date().toISOString(),
      };
    },
    onSuccess: (data) => {
      setTestResult(data);
      toast.success('Test webhook sent', {
        description: `Response: ${data.status} in ${data.duration}ms`,
      });
    },
    onError: (error: Error) => {
      setTestResult({
        success: false,
        status: 0,
        response: error.message,
        message: 'Failed to send test webhook',
        timestamp: new Date().toISOString(),
      });
      toast.error('Failed to send test webhook', {
        description: error.message,
      });
    },
  });

  const handleTest = () => {
    setTestResult(null);
    testWebhookMutation.mutate();
  };

  const handleClose = () => {
    setTestResult(null);
    setSelectedEvent("webhook.test");
    setCustomPayload("");
    setUseCustomPayload(false);
    onOpenChange(false);
  };

  // Initialize payload when dialog opens
  useState(() => {
    if (open && !customPayload) {
      const samplePayload = SAMPLE_PAYLOADS[selectedEvent] || SAMPLE_PAYLOADS["webhook.test"];
      setCustomPayload(JSON.stringify(samplePayload, null, 2));
    }
  });

  // Filter available events based on webhook subscription
  const availableEvents = EVENT_OPTIONS.filter(
    event => webhookEvents.includes(event.value) || event.value === "webhook.test"
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Webhook Testing Tool</DialogTitle>
          <DialogDescription>
            ทดสอบ webhook endpoint และดู real-time response
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Webhook URL */}
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-mono break-all">{webhookUrl}</p>
            </div>
          </div>

          {/* Configuration Tabs */}
          <Tabs defaultValue="simple" className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="simple" className="gap-2">
                <Send className="w-4 h-4" />
                Simple Test
              </TabsTrigger>
              <TabsTrigger value="custom" className="gap-2">
                <Code className="w-4 h-4" />
                Custom Payload
              </TabsTrigger>
            </TabsList>

            <TabsContent value="simple" className="space-y-4 flex-1">
              {/* Event Selector */}
              <div className="space-y-2">
                <Label>Select Event Type</Label>
                <Select value={selectedEvent} onValueChange={(val) => {
                  handleEventChange(val);
                  setUseCustomPayload(false);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือก event type" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEvents.map((event) => (
                      <SelectItem key={event.value} value={event.value}>
                        <div className="flex flex-col">
                          <span className="font-medium">{event.label}</span>
                          <span className="text-xs text-muted-foreground">{event.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sample Payload Preview */}
              <div className="space-y-2">
                <Label>Sample Payload</Label>
                <ScrollArea className="h-40 border rounded-lg">
                  <div className="p-3 bg-muted/30">
                    <pre className="text-xs font-mono">
                      {JSON.stringify(SAMPLE_PAYLOADS[selectedEvent] || SAMPLE_PAYLOADS["webhook.test"], null, 2)}
                    </pre>
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="custom" className="space-y-4 flex-1">
              {/* Event Selector */}
              <div className="space-y-2">
                <Label>Event Type (for reference)</Label>
                <Select value={selectedEvent} onValueChange={handleEventChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือก event type" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEvents.map((event) => (
                      <SelectItem key={event.value} value={event.value}>
                        <div className="flex flex-col">
                          <span className="font-medium">{event.label}</span>
                          <span className="text-xs text-muted-foreground">{event.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Payload Editor */}
              <div className="space-y-2 flex-1 flex flex-col">
                <div className="flex items-center justify-between">
                  <Label>Custom JSON Payload</Label>
                  <Badge variant="outline" className="gap-1">
                    <Code className="w-3 h-3" />
                    JSON
                  </Badge>
                </div>
                <Textarea
                  value={customPayload}
                  onChange={(e) => {
                    setCustomPayload(e.target.value);
                    setUseCustomPayload(true);
                  }}
                  placeholder='{"event": "webhook.test", "data": {...}}'
                  className="font-mono text-xs flex-1 min-h-[200px]"
                />
                <p className="text-xs text-muted-foreground">
                  แก้ไข JSON payload ตามต้องการ - ระบบจะส่งค่านี้ไปยัง webhook endpoint
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Test Button */}
          <Button
            onClick={handleTest}
            disabled={testWebhookMutation.isPending}
            className="w-full gap-2"
          >
            {testWebhookMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending test event...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send Test Event
              </>
            )}
          </Button>

          {/* Test Result */}
          {testResult && (
            <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center gap-2">
                <Label className="text-base">Response</Label>
                <Badge variant={testResult.success ? "default" : "destructive"} className="gap-1">
                  {testResult.success ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      Success
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3" />
                      Failed
                    </>
                  )}
                </Badge>
              </div>

              <ScrollArea className="flex-1 border rounded-lg">
                <div className="p-4 space-y-4">
                  {/* Response Status */}
                  <div className="space-y-2">
                    <Label className="text-sm">HTTP Status</Label>
                    <div className="flex items-center gap-2">
                      <Badge variant={testResult.success ? "default" : "destructive"}>
                        {testResult.status || 'ERROR'}
                      </Badge>
                      {testResult.duration && (
                        <Badge variant="outline" className="gap-1">
                          <Clock className="w-3 h-3" />
                          {testResult.duration}ms
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Timestamp */}
                  {testResult.timestamp && (
                    <div className="space-y-2">
                      <Label className="text-sm">Timestamp</Label>
                      <p className="text-sm font-mono bg-muted/50 p-2 rounded">
                        {new Date(testResult.timestamp).toLocaleString('th-TH')}
                      </p>
                    </div>
                  )}

                  {/* Response Body */}
                  <div className="space-y-2">
                    <Label className="text-sm">Response Body</Label>
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                        {testResult.response || testResult.message}
                      </pre>
                    </div>
                  </div>

                  {/* Request Headers */}
                  {testResult.requestHeaders && (
                    <div className="space-y-2">
                      <Label className="text-sm">Request Headers</Label>
                      <div className="bg-muted/50 p-3 rounded-lg space-y-1">
                        {Object.entries(testResult.requestHeaders).map(([key, value]) => (
                          <div key={key} className="text-xs font-mono">
                            <span className="text-muted-foreground">{key}:</span>{' '}
                            <span className="break-all">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Request Payload */}
                  {testResult.requestPayload && (
                    <div className="space-y-2">
                      <Label className="text-sm">Request Payload</Label>
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <pre className="text-xs font-mono whitespace-pre-wrap">
                          {JSON.stringify(testResult.requestPayload, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
