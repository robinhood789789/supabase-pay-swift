import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Mail, Phone, Download } from "lucide-react";
import { format } from "date-fns";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { sanitizeClientError } from "@/lib/security/clientErrorHandling";
import { use2FAChallenge } from "@/hooks/use2FAChallenge";
import { TwoFactorChallenge } from "./security/TwoFactorChallenge";

export const CustomersTable = () => {
  const { activeTenantId } = useTenantSwitcher();
  const { t } = useI18n();
  const [searchTerm, setSearchTerm] = useState("");
  const { isOpen, setIsOpen, checkAndChallenge, onSuccess } = use2FAChallenge(); // H-9: MFA

  // H-9: PII Masking helper
  const maskEmail = (email: string) => {
    if (!email) return "-";
    const [local, domain] = email.split('@');
    return `${local.slice(0, 2)}${"*".repeat(Math.max(local.length - 2, 3))}@${domain}`;
  };

  const maskPhone = (phone: string) => {
    if (!phone) return "-";
    return phone.slice(0, 3) + "*".repeat(phone.length - 6) + phone.slice(-3);
  };

  // Derive phone from optional column or metadata JSON
  const getPhone = (customer: any): string => {
    const meta = (customer?.metadata as any) || {};
    const phone = (customer as any)?.phone ?? meta?.phone ?? "";
    return typeof phone === "string" ? phone : "";
  };
  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers", activeTenantId],
    queryFn: async () => {
      if (!activeTenantId) return [];

      const { data, error } = await supabase
        .from("customers")
        .select(`
          *,
          payments:payments(count)
        `)
        .eq("tenant_id", activeTenantId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!activeTenantId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const filteredCustomers = customers?.filter(customer => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      customer.name?.toLowerCase().includes(term) ||
      customer.email?.toLowerCase().includes(term) ||
      getPhone(customer).toLowerCase().includes(term)
    );
  });

  // H-9: Bulk export with MFA
  const handleExportCSV = async () => {
    if (!customers || customers.length === 0) {
      toast.error("ไม่มีข้อมูลลูกค้าให้ export");
      return;
    }

    // MFA required for PII export
    checkAndChallenge(async () => {
      try {
        const csv = [
          ['Name', 'Email', 'Phone', 'Payments Count', 'Created Date'].join(','),
          ...customers.map(c => [
            c.name || '',
            c.email || '',
            getPhone(c) || '',
            (c.payments as any)?.[0]?.count || 0,
            format(new Date(c.created_at), 'yyyy-MM-dd')
          ].join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `customers-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        // Audit log
        await supabase.from('audit_logs').insert({
          tenant_id: activeTenantId,
          action: 'customers.export.pii',
          target: 'customers',
          after: { count: customers.length }
        });

        toast.success(`Export สำเร็จ ${customers.length} รายการ`);
      } catch (error: any) {
        toast.error("Export ไม่สำเร็จ", { description: sanitizeClientError(error) });
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('customers.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={handleExportCSV} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {!filteredCustomers || filteredCustomers.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <p className="text-muted-foreground mb-4">{t('customers.noCustomers')}</p>
          <p className="text-sm text-muted-foreground">{t('customers.noCustomersDesc')}</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('customers.name')}</TableHead>
                <TableHead>{t('customers.email')}</TableHead>
                <TableHead>{t('customers.phone')}</TableHead>
                <TableHead>{t('customers.totalPayments')}</TableHead>
                <TableHead>{t('customers.joinedDate')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">
                    {customer.name || "-"}
                  </TableCell>
                  <TableCell>
                    {customer.email ? (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="max-w-xs truncate" title={customer.email}>
                          {maskEmail(customer.email)}
                        </span>
                      </div>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {getPhone(customer) ? (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{maskPhone(getPhone(customer))}</span>
                      </div>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {(customer.payments as any)?.[0]?.count || 0}
                  </TableCell>
                  <TableCell>
                    {format(new Date(customer.created_at), "PPp")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TwoFactorChallenge open={isOpen} onOpenChange={setIsOpen} onSuccess={onSuccess} />
    </div>
  );
};
