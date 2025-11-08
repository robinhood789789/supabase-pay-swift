import DashboardLayout from "@/components/DashboardLayout";
import { RequireTenant } from "@/components/RequireTenant";
import { PermissionGate } from "@/components/PermissionGate";
import { ActivityLog } from "@/components/security/ActivityLog";
import { useI18n } from "@/lib/i18n";
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";

const ActivityHistory = () => {
  const { t } = useI18n();
  const { activeTenantId } = useTenantSwitcher();
  
  return (
    <DashboardLayout>
      <RequireTenant>
        <div className="p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {t('activityLog.title')}
              </h1>
              <p className="text-muted-foreground">
                {t('activityLog.description')}
              </p>
            </div>

            <PermissionGate 
              permission="audit.view"
              fallback={
                <div className="text-center p-8 border rounded-lg bg-card">
                  <p className="text-muted-foreground">
                    {t('activityLog.noPermission')}
                  </p>
                </div>
              }
            >
              {activeTenantId && <ActivityLog tenantId={activeTenantId} />}
            </PermissionGate>
          </div>
        </div>
      </RequireTenant>
    </DashboardLayout>
  );
};

export default ActivityHistory;
