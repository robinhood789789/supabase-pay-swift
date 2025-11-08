import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { RequireTenant } from "@/components/RequireTenant";
import { PermissionGate } from "@/components/PermissionGate";
import { use2FAChallenge } from "@/hooks/use2FAChallenge";
import { TwoFactorChallenge } from "@/components/security/TwoFactorChallenge";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunctionWithTenant } from "@/lib/supabaseFunctions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle, XCircle, Clock, Eye, ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";

const Approvals = () => {
  const { activeTenantId } = useTenantSwitcher();
  const [selectedApproval, setSelectedApproval] = useState<any>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [decisionComment, setDecisionComment] = useState("");
  const queryClient = useQueryClient();
  const { isOpen, setIsOpen, checkAndChallenge, onSuccess } = use2FAChallenge();

  const { data: approvals, isLoading } = useQuery({
    queryKey: ["approvals", activeTenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approvals")
        .select("*")
        .eq("tenant_id", activeTenantId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles for requesters
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(a => a.requested_by))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
        
        return data.map(approval => ({
          ...approval,
          requester: profilesMap.get(approval.requested_by)
        }));
      }

      return data || [];
    },
    enabled: !!activeTenantId,
  });

  const decideMutation = useMutation({
    mutationFn: async ({ approvalId, decision }: { approvalId: string; decision: "approve" | "reject" }) => {
      const { data, error } = await invokeFunctionWithTenant("approvals-decide", {
        body: {
          approvalId,
          decision,
          comment: decisionComment,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals", activeTenantId] });
      setDetailDialogOpen(false);
      setDecisionComment("");
      toast.success("Approval decision recorded");
    },
    onError: (error: any) => {
      toast.error("Failed to process decision", { description: error.message });
    },
  });

  const handleDecision = (decision: "approve" | "reject") => {
    if (!selectedApproval) return;
    checkAndChallenge(() => decideMutation.mutate({ approvalId: selectedApproval.id, decision }));
  };

  const handleViewDetails = (approval: any) => {
    setSelectedApproval(approval);
    setDetailDialogOpen(true);
  };

  const pendingApprovals = approvals?.filter(a => a.status === "pending") || [];
  const processedApprovals = approvals?.filter(a => a.status !== "pending") || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" />Pending</Badge>;
      case "approved":
        return <Badge variant="default" className="gap-1"><CheckCircle className="w-3 h-3" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <RequireTenant>
        <PermissionGate
          allowOwner
          permissions={["approvals.view", "approvals.approve"]}
          fallback={
            <div className="p-6">
              <Card>
                <CardHeader>
                  <CardTitle>Access Denied</CardTitle>
                  <CardDescription>
                    Only owners and managers can manage approvals
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          }
        >
          <div className="p-6 space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Approval Queue</h1>
              <p className="text-muted-foreground">
                Review and approve requests that require dual control
              </p>
            </div>

            <Tabs defaultValue="pending" className="space-y-4">
              <TabsList>
                <TabsTrigger value="pending" className="gap-2">
                  Pending
                  {pendingApprovals.length > 0 && (
                    <Badge variant="destructive" className="ml-1">{pendingApprovals.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="processed">Processed</TabsTrigger>
              </TabsList>

              <TabsContent value="pending">
                <Card>
                  <CardHeader>
                    <CardTitle>Pending Approvals</CardTitle>
                    <CardDescription>
                      Requests awaiting your approval
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="text-center py-8 text-muted-foreground">Loading...</div>
                    ) : pendingApprovals.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No pending approvals</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[600px]">
                        <div className="space-y-4">
                          {pendingApprovals.map((approval) => (
                            <div
                              key={approval.id}
                              className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge variant="secondary">{approval.action_type}</Badge>
                                    {getStatusBadge(approval.status)}
                                  </div>
                                  <p className="text-sm text-muted-foreground mb-2">
                                    Requested by: {(approval as any).requester?.full_name || (approval as any).requester?.email || "Unknown"}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {format(new Date(approval.created_at), "PPp")}
                                  </p>
                                  {(approval as any).reason && (
                                    <p className="text-sm mt-2">Reason: {(approval as any).reason}</p>
                                  )}
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewDetails(approval)}
                                  className="gap-2"
                                >
                                  <Eye className="w-4 h-4" />
                                  Review
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="processed">
                <Card>
                  <CardHeader>
                    <CardTitle>Processed Approvals</CardTitle>
                    <CardDescription>
                      Historical approval decisions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="text-center py-8 text-muted-foreground">Loading...</div>
                    ) : processedApprovals.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No processed approvals</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[600px]">
                        <div className="space-y-4">
                          {processedApprovals.map((approval) => (
                            <div
                              key={approval.id}
                              className="p-4 border rounded-lg"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge variant="secondary">{approval.action_type}</Badge>
                                    {getStatusBadge(approval.status)}
                                  </div>
                                  <p className="text-sm text-muted-foreground mb-1">
                                    Requested by: {(approval as any).requester?.full_name || (approval as any).requester?.email || "Unknown"}
                                  </p>
                                  <p className="text-sm text-muted-foreground mb-1">
                                    Requested: {format(new Date(approval.created_at), "PPp")}
                                  </p>
                                  {approval.reviewed_at && (
                                    <p className="text-sm text-muted-foreground">
                                      Decided: {format(new Date(approval.reviewed_at), "PPp")}
                                    </p>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewDetails(approval)}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Approval Details</DialogTitle>
                <DialogDescription>
                  Review the request and make a decision
                </DialogDescription>
              </DialogHeader>

              {selectedApproval && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Action Type</Label>
                      <p className="font-medium">{selectedApproval.action_type}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Status</Label>
                      <div className="mt-1">{getStatusBadge(selectedApproval.status)}</div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Requested By</Label>
                      <p className="font-medium">
                        {(selectedApproval as any).requester?.full_name || (selectedApproval as any).requester?.email || "Unknown"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Requested At</Label>
                      <p className="font-medium">
                        {format(new Date(selectedApproval.created_at), "PPp")}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <Label className="text-muted-foreground">Action Data</Label>
                    <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-x-auto">
                      {JSON.stringify(selectedApproval.action_data, null, 2)}
                    </pre>
                  </div>

                  {(selectedApproval as any).reason && (
                    <div>
                      <Label className="text-muted-foreground">Reason</Label>
                      <p className="mt-1">{(selectedApproval as any).reason}</p>
                    </div>
                  )}

                  {selectedApproval.status === "pending" && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <Label htmlFor="comment">Decision Comment (Optional)</Label>
                        <Textarea
                          id="comment"
                          placeholder="Add a comment about your decision..."
                          value={decisionComment}
                          onChange={(e) => setDecisionComment(e.target.value)}
                          rows={3}
                        />
                      </div>
                    </>
                  )}

                  {selectedApproval.review_notes && (
                    <div>
                      <Label className="text-muted-foreground">Decision Comment</Label>
                      <p className="mt-1">{selectedApproval.review_notes}</p>
                    </div>
                  )}
                </div>
              )}

              {selectedApproval?.status === "pending" && (
                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setDetailDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleDecision("reject")}
                    disabled={decideMutation.isPending}
                    className="gap-2"
                  >
                    <ThumbsDown className="w-4 h-4" />
                    Reject
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => handleDecision("approve")}
                    disabled={decideMutation.isPending}
                    className="gap-2"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    Approve
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>

          <TwoFactorChallenge open={isOpen} onOpenChange={setIsOpen} onSuccess={onSuccess} />
        </PermissionGate>
      </RequireTenant>
    </DashboardLayout>
  );
};

export default Approvals;
