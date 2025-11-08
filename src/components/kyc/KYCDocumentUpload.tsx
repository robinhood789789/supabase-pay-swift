import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";

const documentTypes = [
  { value: "national_id", label: "National ID / บัตรประชาชน" },
  { value: "passport", label: "Passport / หนังสือเดินทาง" },
  { value: "drivers_license", label: "Driver's License / ใบขับขี่" },
  { value: "business_registration", label: "Business Registration / ทะเบียนธุรกิจ" },
  { value: "tax_certificate", label: "Tax Certificate / หนังสือรับรองภาษี" },
  { value: "bank_statement", label: "Bank Statement / Statement ธนาคาร" },
  { value: "proof_of_address", label: "Proof of Address / หลักฐานที่อยู่" },
];

const getStatusBadge = (status: string) => {
  const badges = {
    pending: { icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50", label: "รอตรวจสอบ" },
    under_review: { icon: Clock, color: "text-blue-600", bg: "bg-blue-50", label: "กำลังตรวจสอบ" },
    approved: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", label: "อนุมัติแล้ว" },
    rejected: { icon: XCircle, color: "text-red-600", bg: "bg-red-50", label: "ไม่อนุมัติ" },
    expired: { icon: XCircle, color: "text-gray-600", bg: "bg-gray-50", label: "หมดอายุ" },
  };
  const badge = badges[status as keyof typeof badges] || badges.pending;
  const Icon = badge.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${badge.bg} ${badge.color}`}>
      <Icon className="h-4 w-4" />
      {badge.label}
    </span>
  );
};

export const KYCDocumentUpload = () => {
  const { activeTenantId } = useTenantSwitcher();
  const queryClient = useQueryClient();
  const [documentType, setDocumentType] = useState<string>("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const uploadMutation = useMutation({
    mutationFn: async (data: { type: string; number: string; expiry?: string }) => {
      if (!activeTenantId) throw new Error("No active tenant");

      // Insert document record
      const { data: doc, error } = await supabase
        .from("kyc_documents")
        .insert([{
          tenant_id: activeTenantId,
          document_type: data.type as any,
          document_number: data.number,
          expiry_date: data.expiry || null,
          status: "pending" as any,
        }])
        .select()
        .single();

      if (error) throw error;

      // Log the action
      await supabase.from("kyc_verification_logs").insert({
        tenant_id: activeTenantId,
        document_id: doc.id,
        action: "document_uploaded",
        new_status: "pending",
        notes: `Uploaded ${data.type}`,
      });

      return doc;
    },
    onSuccess: () => {
      toast.success("อัปโหลดเอกสารสำเร็จ", {
        description: "เอกสารของคุณอยู่ระหว่างรอการตรวจสอบ",
      });
      queryClient.invalidateQueries({ queryKey: ["kyc-documents"] });
      setDocumentType("");
      setDocumentNumber("");
      setExpiryDate("");
    },
    onError: (error: Error) => {
      toast.error("เกิดข้อผิดพลาด", {
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentType) {
      toast.error("กรุณาเลือกประเภทเอกสาร");
      return;
    }
    uploadMutation.mutate({
      type: documentType,
      number: documentNumber,
      expiry: expiryDate,
    });
  };

  return (
    <Card className="border-primary/20 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          <div>
            <CardTitle>อัปโหลดเอกสาร KYC</CardTitle>
            <CardDescription>
              กรุณาอัปโหลดเอกสารเพื่อยืนยันตัวตนและอนุมัติธุรกรรม
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="documentType">ประเภทเอกสาร</Label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger>
                <SelectValue placeholder="เลือกประเภทเอกสาร" />
              </SelectTrigger>
              <SelectContent>
                {documentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="documentNumber">เลขที่เอกสาร (ถ้ามี)</Label>
            <Input
              id="documentNumber"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              placeholder="ระบุเลขที่เอกสาร"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiryDate">วันหมดอายุ (ถ้ามี)</Label>
            <Input
              id="expiryDate"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={uploadMutation.isPending || !documentType}
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploadMutation.isPending ? "กำลังอัปโหลด..." : "อัปโหลดเอกสาร"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
