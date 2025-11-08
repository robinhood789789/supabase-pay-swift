import DashboardLayout from "@/components/DashboardLayout";
import { RequireTenant } from "@/components/RequireTenant";
import { PermissionGate } from "@/components/PermissionGate";
import { RefundsTable } from "@/components/RefundsTable";
import { useI18n } from "@/lib/i18n";

const Refunds = () => {
  const { t } = useI18n();
  
  return (
    <DashboardLayout>
      <RequireTenant>
        <div className="p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">{t('refunds.title')}</h1>
              <p className="text-muted-foreground">{t('refunds.viewManage')}</p>
            </div>

            <PermissionGate 
              permission="refunds:read"
              fallback={
                <div className="text-center p-8 border rounded-lg">
                  <p className="text-muted-foreground">{t('refunds.noPermission')}</p>
                </div>
              }
            >
              <RefundsTable />
            </PermissionGate>
          </div>
        </div>
      </RequireTenant>
    </DashboardLayout>
  );
};

export default Refunds;
