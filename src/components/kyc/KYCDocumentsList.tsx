import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, Clock, FileText } from "lucide-react";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";
import { use2FAChallenge } from "@/hooks/use2FAChallenge";
import { TwoFactorChallenge } from "@/components/security/TwoFactorChallenge";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { toast } from "sonner";

const documentTypeLabels: Record<string, string> = {
  national_id: "บัตรประชาชน",
  passport: "หนังสือเดินทาง",
  drivers_license: "ใบขับขี่",
  business_registration: "ทะเบียนธุรกิจ",
  tax_certificate: "หนังสือรับรองภาษี",
  bank_statement: "Statement ธนาคาร",
  proof_of_address: "หลักฐานที่อยู่",
};

const getStatusBadge = (status: string) => {
  const badges = {
    pending: { icon: Clock, variant: "outline" as const, label: "รอตรวจสอบ", className: "border-yellow-600 text-yellow-700" },
    under_review: { icon: Clock, variant: "outline" as const, label: "กำลังตรวจสอบ", className: "border-blue-600 text-blue-700" },
    approved: { icon: CheckCircle2, variant: "default" as const, label: "อนุมัติ", className: "bg-green-600 text-white" },
    rejected: { icon: XCircle, variant: "destructive" as const, label: "ไม่อนุมัติ", className: "" },
    expired: { icon: XCircle, variant: "secondary" as const, label: "หมดอายุ", className: "" },
  };
  const badge = badges[status as keyof typeof badges] || badges.pending;
  const Icon = badge.icon;
  return (
    <Badge variant={badge.variant} className={badge.className}>
      <Icon className="mr-1 h-3 w-3" />
      {badge.label}
    </Badge>
  );
};

export const KYCDocumentsList = () => {
  const { activeTenantId } = useTenantSwitcher();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isOpen, setIsOpen, checkAndChallenge, onSuccess } = use2FAChallenge();
  const [actionDialog, setActionDialog] = useState<{ open: boolean; docId: string; action: 'approve' | 'reject' }>({
    open: false,
    docId: '',
    action: 'approve'
  });
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: documents, isLoading } = useQuery({
    queryKey: ["kyc-documents", activeTenantId],
    queryFn: async () => {
      if (!activeTenantId) return [];
      const { data, error } = await supabase
        .from("kyc_documents")
        .select("*")
        .eq("tenant_id", activeTenantId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!activeTenantId,
  });

  const updateDocumentMutation = useMutation({
    mutationFn: async ({ docId, status, reason }: { docId: string; status: string; reason?: string }) => {
      const updates: any = {
        status,
        verified_at: new Date().toISOString(),
        verified_by: user?.id,
      };
      if (reason) {
        updates.rejection_reason = reason;
      }

      const { error } = await supabase
        .from("kyc_documents")
        .update(updates)
        .eq("id", docId);

      if (error) throw error;

      // Log audit
      await supabase.from('audit_logs').insert({
        tenant_id: activeTenantId,
        actor_user_id: user?.id,
        action: `kyc_document_${status}`,
        target: `kyc_documents:${docId}`,
        after: { status, reason }
      });
    },
    onSuccess: (_, variables) => {
      toast.success(variables.status === "approved" ? "เอกสารได้รับการอนุมัติ" : "เอกสารถูกปฏิเสธ");
      queryClient.invalidateQueries({ queryKey: ["kyc-documents"] });
      queryClient.invalidateQueries({ queryKey: ["kyc-stats"] });
      setActionDialog({ open: false, docId: '', action: 'approve' });
      setRejectionReason("");
    },
    onError: (error: Error) => {
      toast.error(error.message || "เกิดข้อผิดพลาด");
    },
  });

  const handleApprove = (docId: string) => {
    setActionDialog({ open: true, docId, action: 'approve' });
  };

  const handleReject = (docId: string) => {
    setActionDialog({ open: true, docId, action: 'reject' });
  };

  const handleConfirmAction = () => {
    const { docId, action } = actionDialog;
    
    checkAndChallenge(() => {
      updateDocumentMutation.mutate({
        docId,
        status: action === 'approve' ? 'approved' : 'rejected',
        reason: action === 'reject' ? rejectionReason : undefined,
      });
    });
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>;
  }

  if (!documents || documents.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>ยังไม่มีเอกสาร KYC</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            เอกสาร KYC ที่อัปโหลด
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ประเภทเอกสาร</TableHead>
                <TableHead>เลขที่</TableHead>
                <TableHead>วันหมดอายุ</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>วันที่อัปโหลด</TableHead>
                <TableHead>หมายเหตุ</TableHead>
                <TableHead className="text-right">การดำเนินการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">
                    {documentTypeLabels[doc.document_type] || doc.document_type}
                  </TableCell>
                  <TableCell>{doc.document_number || "-"}</TableCell>
                  <TableCell>
                    {doc.expiry_date ? format(new Date(doc.expiry_date), "dd/MM/yyyy") : "-"}
                  </TableCell>
                  <TableCell>{getStatusBadge(doc.status)}</TableCell>
                  <TableCell>{format(new Date(doc.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {doc.rejection_reason || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {doc.status === 'pending' ? (
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApprove(doc.id)}
                          className="text-green-600 hover:text-green-700"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          อนุมัติ
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(doc.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          ปฏิเสธ
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={actionDialog.open} onOpenChange={(open) => setActionDialog({ ...actionDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.action === 'approve' ? 'อนุมัติเอกสาร KYC' : 'ปฏิเสธเอกสาร KYC'}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.action === 'approve' 
                ? 'คุณแน่ใจหรือไม่ว่าต้องการอนุมัติเอกสารนี้? การดำเนินการนี้ต้องการ 2FA'
                : 'กรุณาระบุเหตุผลในการปฏิเสธ การดำเนินการนี้ต้องการ 2FA'
              }
            </DialogDescription>
          </DialogHeader>
          {actionDialog.action === 'reject' && (
            <div className="space-y-2">
              <Label>เหตุผล</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="ระบุเหตุผลในการปฏิเสธ..."
                rows={3}
              />
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setActionDialog({ open: false, docId: '', action: 'approve' });
                setRejectionReason("");
              }}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleConfirmAction}
              disabled={actionDialog.action === 'reject' && !rejectionReason.trim()}
              variant={actionDialog.action === 'approve' ? 'default' : 'destructive'}
            >
              {actionDialog.action === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TwoFactorChallenge
        open={isOpen}
        onOpenChange={setIsOpen}
        onSuccess={onSuccess}
        title="ยืนยัน 2FA"
        description="กรอกรหัส 6 หลักเพื่อดำเนินการต่อ"
      />
    </>
  );
};
