import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertCircle, FileText, CheckCircle, XCircle, Upload } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { PermissionGate } from "@/components/PermissionGate";
import { use2FAChallenge } from "@/hooks/use2FAChallenge";
import { TwoFactorChallenge } from "@/components/security/TwoFactorChallenge";

const Disputes = () => {
  const queryClient = useQueryClient();
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null); // H-12: Evidence upload
  const [updateStatus, setUpdateStatus] = useState("");
  const { isOpen, setIsOpen, checkAndChallenge, onSuccess } = use2FAChallenge(); // H-12: MFA

  const { data: disputes, isLoading } = useQuery({
    queryKey: ["disputes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disputes")
        .select(`
          *,
          payments (
            id,
            amount,
            currency,
            status,
            provider
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // H-12: Update dispute with MFA
  const updateDisputeMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase
        .from("disputes")
        .update(updates)
        .eq("id", id);

      if (error) throw error;

      // Audit log
      await supabase.from('audit_logs').insert({
        action: 'disputes.update',
        target: id,
        after: updates
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disputes"] });
      toast.success("Dispute updated successfully");
      setSelectedDispute(null);
      setEvidenceFile(null);
    },
    onError: (error: Error) => {
      toast.error("Failed to update dispute", { description: error.message });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      open: "default",
      won: "secondary",
      lost: "destructive",
      closed: "outline",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  const getStageBadge = (stage: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      inquiry: "default",
      chargeback: "destructive",
      arbitration: "secondary",
    };
    return <Badge variant={variants[stage] || "default"}>{stage}</Badge>;
  };

  // H-12: Handle update with MFA
  const handleUpdateDispute = () => {
    if (!selectedDispute) return;

    const updates: any = {};
    if (evidenceUrl) updates.evidence_url = evidenceUrl;
    if (evidenceFile) {
      toast.info("File upload feature coming soon - use URL for now");
    }
    if (updateStatus) updates.status = updateStatus;

    if (Object.keys(updates).length === 0) {
      toast.error("No changes to save");
      return;
    }

    // MFA challenge before updating
    checkAndChallenge(() => updateDisputeMutation.mutate({ id: selectedDispute.id, updates }));
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dispute Management</h1>
          <p className="text-muted-foreground">Manage payment disputes and chargebacks</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Disputes</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {disputes?.filter((d) => d.status === "open").length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Won</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {disputes?.filter((d) => d.status === "won").length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lost</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {disputes?.filter((d) => d.status === "lost").length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat("th-TH", {
                style: "currency",
                currency: "THB",
              }).format(
                disputes?.reduce((sum, d) => sum + Number(d.amount), 0) / 100 || 0
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Disputes</CardTitle>
          <CardDescription>View and manage payment disputes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {disputes?.map((dispute) => (
              <Card key={dispute.id} className="hover:bg-accent/50 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{dispute.id.slice(0, 8)}</span>
                        {getStatusBadge(dispute.status)}
                        {getStageBadge(dispute.stage)}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Amount: </span>
                          <span className="font-semibold">
                            {new Intl.NumberFormat("th-TH", {
                              style: "currency",
                              currency: dispute.currency,
                            }).format(Number(dispute.amount) / 100)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Payment ID: </span>
                          <span className="font-mono text-xs">{dispute.payment_id.slice(0, 8)}</span>
                        </div>
                        {dispute.reason && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Reason: </span>
                            <span>{dispute.reason}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground">Created: </span>
                          <span>{formatDistanceToNow(new Date(dispute.created_at))} ago</span>
                        </div>
                        {dispute.due_at && (
                          <div>
                            <span className="text-muted-foreground">Due: </span>
                            <span>{formatDistanceToNow(new Date(dispute.due_at))}</span>
                          </div>
                        )}
                      </div>

                      {dispute.evidence_url && (
                        <div className="pt-2">
                          <a
                            href={dispute.evidence_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            <FileText className="h-3 w-3" />
                            View Evidence
                          </a>
                        </div>
                      )}
                    </div>

                    <PermissionGate permission="disputes.write">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedDispute(dispute);
                              setEvidenceUrl(dispute.evidence_url || "");
                              setUpdateStatus("");
                            }}
                          >
                            Manage
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Update Dispute</DialogTitle>
                            <DialogDescription>
                              Update dispute status or add evidence
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="evidence">Evidence URL</Label>
                              <Input
                                id="evidence"
                                value={evidenceUrl}
                                onChange={(e) => setEvidenceUrl(e.target.value)}
                                placeholder="https://..."
                              />
                            </div>
                            <div>
                              <Label htmlFor="evidenceFile">Upload Evidence (optional)</Label>
                              <Input
                                id="evidenceFile"
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Supported: PDF, JPG, PNG (max 10MB)
                              </p>
                            </div>
                            <div>
                              <Label htmlFor="status">Update Status</Label>
                              <Select value={updateStatus} onValueChange={setUpdateStatus}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="open">Open</SelectItem>
                                  <SelectItem value="won">Won</SelectItem>
                                  <SelectItem value="lost">Lost</SelectItem>
                                  <SelectItem value="closed">Closed</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={handleUpdateDispute} disabled={updateDisputeMutation.isPending}>
                              {updateDisputeMutation.isPending ? "Saving..." : "Save Changes"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </PermissionGate>
                  </div>
                </CardContent>
              </Card>
            ))}

            {!disputes || disputes.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No disputes found
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <TwoFactorChallenge open={isOpen} onOpenChange={setIsOpen} onSuccess={onSuccess} />
    </div>
  );
};

export default Disputes;
