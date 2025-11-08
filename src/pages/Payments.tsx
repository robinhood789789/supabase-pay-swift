import DashboardLayout from "@/components/DashboardLayout";
import { TenantGuardMessage } from "@/components/RequireTenant";
import { PaymentsTable } from "@/components/PaymentsTable";
import { PaymentsStats } from "@/components/PaymentsStats";
import { useI18n } from "@/lib/i18n";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";
import { usePermissions } from "@/hooks/usePermissions";

const Payments = () => {
  const { t } = useI18n();
  const { activeTenantId, isLoading } = useTenantSwitcher();
  const { hasPermission } = usePermissions();
  const canViewPayments = hasPermission("payments.view");
  
  return (
    <DashboardLayout>
      {isLoading ? (
        <div className="flex items-center justify-center min-h-screen">
          <span className="text-muted-foreground">Loading...</span>
        </div>
      ) : !activeTenantId ? (
        <TenantGuardMessage />
      ) : (
        <div className="p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">{t('payments.title')}</h1>
              <p className="text-muted-foreground">{t('payments.viewManage')}</p>
            </div>

            {canViewPayments ? (
              <>
                <PaymentsStats />
                <PaymentsTable />
              </>
            ) : (
              <div className="text-center p-8 border rounded-lg">
                <p className="text-muted-foreground">
                  คุณไม่มีสิทธิ์เข้าถึงหน้านี้
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default Payments;
