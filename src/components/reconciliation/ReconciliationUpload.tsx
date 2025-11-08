import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, CheckCircle2, XCircle, AlertCircle, Info } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useMfaGuard } from "@/hooks/useMfaGuard";

export default function ReconciliationUpload() {
  const { activeTenantId } = useTenantSwitcher();
  const queryClient = useQueryClient();
  const { isLoading: mfaLoading } = useMfaGuard({ required: true });
  const [file, setFile] = useState<File | null>(null);
  const [provider, setProvider] = useState<string>("auto");
  const [amountTolerance, setAmountTolerance] = useState<string>("0");
  const [dateWindowDays, setDateWindowDays] = useState<string>("3");
  const [uploadResult, setUploadResult] = useState<any>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!activeTenantId) throw new Error("No active tenant");

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      // Create FormData for file upload
      const formData = new FormData();
      formData.append("file", file);
      formData.append("provider", provider);
      formData.append("cycle", new Date().toISOString().split('T')[0]);
      formData.append("amountTolerance", amountTolerance);
      formData.append("dateWindowDays", dateWindowDays);

      // Call enhanced reconciliation endpoint
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reconcile-upload-enhanced`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "x-tenant": activeTenantId,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      return await response.json();
    },
    onSuccess: (data) => {
      setUploadResult(data);
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation-payments"] });
      toast.success("Reconciliation completed", {
        description: `Matched: ${data.matched}, Unmatched: ${data.unmatched}, Partial: ${data.partialMatches || 0}`,
      });
    },
    onError: (error: any) => {
      toast.error("Reconciliation failed", {
        description: error.message,
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith(".csv")) {
        toast.error("Invalid file type", {
          description: "Please upload a CSV file",
        });
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error("File too large", {
          description: "Maximum file size is 10MB",
        });
        return;
      }
      setFile(selectedFile);
      setUploadResult(null);
    }
  };

  const handleUpload = () => {
    if (!file) {
      toast.error("No file selected");
      return;
    }
    uploadMutation.mutate(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Reconciliation File</CardTitle>
        <CardDescription>
          Upload bank statement or provider settlement file to reconcile transactions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Enhanced Fuzzy Matching</AlertTitle>
          <AlertDescription>
            Upload CSV files from your payment provider. The system uses advanced fuzzy matching with 90+ point scoring,
            configurable amount tolerance, and date windows to match transactions accurately.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="provider">Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger id="provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-detect</SelectItem>
                <SelectItem value="stripe">Stripe</SelectItem>
                <SelectItem value="opn">OPN</SelectItem>
                <SelectItem value="2c2p">2C2P</SelectItem>
                <SelectItem value="kbank">KBank</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount-tolerance">Amount Tolerance (cents)</Label>
            <Input
              id="amount-tolerance"
              type="number"
              min="0"
              max="100"
              value={amountTolerance}
              onChange={(e) => setAmountTolerance(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date-window">Date Window (days)</Label>
            <Input
              id="date-window"
              type="number"
              min="1"
              max="30"
              value={dateWindowDays}
              onChange={(e) => setDateWindowDays(e.target.value)}
              placeholder="3"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="file-upload">Select CSV File (max 10MB)</Label>
          <div className="flex gap-3">
            <Input
              id="file-upload"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={uploadMutation.isPending || mfaLoading}
            />
            <Button
              onClick={handleUpload}
              disabled={!file || uploadMutation.isPending || mfaLoading}
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploadMutation.isPending ? "Processing..." : "Upload & Reconcile"}
            </Button>
          </div>
        </div>

        {file && (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <div className="font-medium">{file.name}</div>
              <div className="text-sm text-muted-foreground">
                {(file.size / 1024).toFixed(2)} KB
              </div>
            </div>
          </div>
        )}

        {uploadResult && (
          <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
            <h3 className="font-semibold flex items-center gap-2">
              <Info className="h-5 w-5" />
              Reconciliation Results
            </h3>
            <div className="grid gap-3">
              <div className="flex items-center justify-between p-2 bg-background rounded">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="font-medium">Matched</span>
                </div>
                <span className="text-2xl font-bold">{uploadResult.matched || 0}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-background rounded">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  <span className="font-medium">Partial Matches</span>
                </div>
                <span className="text-2xl font-bold">{uploadResult.partialMatches || 0}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-background rounded">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="font-medium">Unmatched</span>
                </div>
                <span className="text-2xl font-bold">{uploadResult.unmatched || 0}</span>
              </div>

              {uploadResult.settlementId && (
                <div className="text-sm text-muted-foreground">
                  Settlement ID: <span className="font-mono">{uploadResult.settlementId}</span>
                </div>
              )}

              {uploadResult.totalAmount && (
                <div className="text-sm">
                  Total Amount: <span className="font-semibold">
                    THB {(uploadResult.totalAmount / 100).toLocaleString()}
                  </span>
                </div>
              )}

              {uploadResult.discrepancies && uploadResult.discrepancies.length > 0 && (
                <div className="mt-2 p-3 bg-yellow-500/10 rounded">
                  <div className="font-medium text-sm mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Discrepancies ({uploadResult.discrepancies.length})
                  </div>
                  <div className="text-sm space-y-1 max-h-48 overflow-y-auto">
                    {uploadResult.discrepancies.slice(0, 5).map((disc: any, i: number) => (
                      <div key={i} className="text-muted-foreground">
                        Row {disc.row}: {disc.amount} {disc.currency || 'THB'} - {disc.reasons.join(', ')}
                      </div>
                    ))}
                    {uploadResult.discrepancies.length > 5 && (
                      <div className="text-xs text-muted-foreground italic">
                        ...and {uploadResult.discrepancies.length - 5} more
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
