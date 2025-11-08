import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { invokeFunctionWithTenant } from "@/lib/supabaseFunctions";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";
import { toast } from "sonner";
import { Plus, Copy, ExternalLink, Link as LinkIcon, QrCode, XCircle, Search } from "lucide-react";
import { format } from "date-fns";
import QRCode from "qrcode";
import { use2FAChallenge } from "@/hooks/use2FAChallenge";
import { TwoFactorChallenge } from "@/components/security/TwoFactorChallenge";
import { PermissionGate } from "@/components/PermissionGate";

interface PaymentLink {
  id: string;
  slug: string;
  amount: number;
  currency: string;
  reference: string | null;
  status: string;
  expires_at: string | null;
  usage_limit: number | null;
  used_count: number;
  created_at: string;
}

const Links = () => {
  const { activeTenantId } = useTenantSwitcher();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const { isOpen, setIsOpen, checkAndChallenge, onSuccess } = use2FAChallenge();
  
  const [formData, setFormData] = useState({
    amount: "",
    currency: "thb",
    reference: "",
    expiresAt: "",
    usageLimit: "",
  });

  // Fetch payment links
  const { data: links, isLoading } = useQuery<PaymentLink[]>({
    queryKey: ["payment-links", activeTenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_links")
        .select("*")
        .eq("tenant_id", activeTenantId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!activeTenantId,
  });

  // Filtered links
  const filteredLinks = links?.filter((link) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      link.reference?.toLowerCase().includes(query) ||
      link.slug.toLowerCase().includes(query) ||
      link.currency.toLowerCase().includes(query)
    );
  });

  // Create payment link mutation
  const createLinkMutation = useMutation({
    mutationFn: async (body: any) => {
      const { data, error } = await invokeFunctionWithTenant("payment-links-create", { body });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-links"] });
      toast.success("Payment link created successfully");
      setIsDialogOpen(false);
      setFormData({
        amount: "",
        currency: "thb",
        reference: "",
        expiresAt: "",
        usageLimit: "",
      });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create payment link");
    },
  });

  // Disable payment link mutation
  const disableLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const { data, error } = await invokeFunctionWithTenant("payment-links-disable", { 
        body: { linkId } 
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-links"] });
      toast.success("Payment link disabled");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to disable payment link");
    },
  });

  const handleCreateLink = () => {
    if (!formData.amount) {
      toast.error("Amount is required");
      return;
    }

    const amountInCents = Math.round(parseFloat(formData.amount) * 100);

    checkAndChallenge(() => 
      createLinkMutation.mutate({
        amount: amountInCents,
        currency: formData.currency,
        reference: formData.reference || null,
        expiresAt: formData.expiresAt || null,
        usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : null,
      })
    );
  };

  const handleCopyLink = (slug: string) => {
    const link = `${window.location.origin}/pay/${slug}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copied to clipboard");
  };

  const handleOpenLink = (slug: string) => {
    window.open(`/pay/${slug}`, "_blank");
  };

  const handleShowQR = async (slug: string) => {
    const link = `${window.location.origin}/pay/${slug}`;
    try {
      const qrUrl = await QRCode.toDataURL(link, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      setQrCodeUrl(qrUrl);
      setQrDialogOpen(true);
    } catch (error) {
      toast.error("Failed to generate QR code");
    }
  };

  const handleDisableLink = (linkId: string) => {
    if (confirm("Are you sure you want to disable this payment link?")) {
      disableLinkMutation.mutate(linkId);
    }
  };

  return (
    <DashboardLayout>
      <PermissionGate
        permissions={["payments.view", "payments.manage"]}
        requireAll={false}
        fallback={
          <div className="p-6">
            <div className="text-center p-8 border rounded-lg">
              <p className="text-muted-foreground">
                คุณไม่มีสิทธิ์เข้าถึงหน้านี้
              </p>
            </div>
          </div>
        }
      >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Payment Links</h1>
              <p className="text-muted-foreground">Create and manage payment links</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Link
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Payment Link</DialogTitle>
                <DialogDescription>
                  Generate a shareable payment link for your customers
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="amount">Amount *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="100.00"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Input
                    id="currency"
                    value={formData.currency}
                    onChange={(e) =>
                      setFormData({ ...formData, currency: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="reference">Reference (optional)</Label>
                  <Input
                    id="reference"
                    placeholder="Order #123"
                    value={formData.reference}
                    onChange={(e) =>
                      setFormData({ ...formData, reference: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="expiresAt">Expires At (optional)</Label>
                  <Input
                    id="expiresAt"
                    type="datetime-local"
                    value={formData.expiresAt}
                    onChange={(e) =>
                      setFormData({ ...formData, expiresAt: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="usageLimit">Usage Limit (optional)</Label>
                  <Input
                    id="usageLimit"
                    type="number"
                    placeholder="10"
                    value={formData.usageLimit}
                    onChange={(e) =>
                      setFormData({ ...formData, usageLimit: e.target.value })
                    }
                  />
                </div>
                <Button
                  onClick={handleCreateLink}
                  className="w-full"
                  disabled={createLinkMutation.isPending}
                >
                  {createLinkMutation.isPending ? "Creating..." : "Create Link"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>

          {/* Search */}
          {links && links.length > 0 && (
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by reference, slug, or currency..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          )}
        </div>

        {/* QR Code Dialog */}
        <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Payment Link QR Code</DialogTitle>
              <DialogDescription>
                Scan this QR code to open the payment link
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center p-6">
              {qrCodeUrl && (
                <img src={qrCodeUrl} alt="QR Code" className="rounded-lg border" />
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Links List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-48" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : !links || links.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <LinkIcon className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">No payment links yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first payment link to get started
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Link
              </Button>
            </CardContent>
          </Card>
        ) : filteredLinks && filteredLinks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Search className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">No matching payment links</p>
              <p className="text-sm text-muted-foreground">
                Try adjusting your search query
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredLinks?.map((link) => (
              <Card key={link.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-xl">
                        {link.currency.toUpperCase()} {(link.amount / 100).toFixed(2)}
                      </CardTitle>
                      <CardDescription>
                        {link.reference && <span className="font-mono">{link.reference}</span>}
                      </CardDescription>
                    </div>
                    <Badge variant={link.status === "active" ? "default" : "secondary"}>
                      {link.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <code className="bg-muted px-2 py-1 rounded text-xs flex-1">
                        {window.location.origin}/pay/{link.slug}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyLink(link.slug)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenLink(link.slug)}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleShowQR(link.slug)}
                      >
                        <QrCode className="w-4 h-4" />
                      </Button>
                      {link.status === "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDisableLink(link.id)}
                          disabled={disableLinkMutation.isPending}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <div>
                        Used: {link.used_count}
                        {link.usage_limit && ` / ${link.usage_limit}`}
                      </div>
                      {link.expires_at && (
                        <div>
                          Expires: {format(new Date(link.expires_at), "MMM d, yyyy HH:mm")}
                        </div>
                      )}
                      <div>
                        Created: {format(new Date(link.created_at), "MMM d, yyyy")}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <TwoFactorChallenge open={isOpen} onOpenChange={setIsOpen} onSuccess={onSuccess} />
      </PermissionGate>
    </DashboardLayout>
  );
};

export default Links;
