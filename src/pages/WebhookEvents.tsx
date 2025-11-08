import DashboardLayout from "@/components/DashboardLayout";
import { RequireTenant } from "@/components/RequireTenant";
import { WebhookEventsTable } from "@/components/WebhookEventsTable";
import { useI18n } from "@/lib/i18n";
import { usePermissions } from "@/hooks/usePermissions";

const WebhookEvents = () => {
  const { t } = useI18n();
  const { hasPermission } = usePermissions();
  
  if (!hasPermission("webhooks.view")) {
    return (
      <DashboardLayout>
        <RequireTenant>
          <div className="p-6">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-3xl font-bold text-foreground">Webhook Events</h1>
              <div className="text-center p-8 border rounded-lg mt-6">
                <p className="text-muted-foreground">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
              </div>
            </div>
          </div>
        </RequireTenant>
      </DashboardLayout>
    );
  }
  
  return (
    <DashboardLayout>
      <RequireTenant>
        <div className="p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Webhook Events</h1>
              <p className="text-muted-foreground">ดูและจัดการ webhook events ทั้งหมด</p>
            </div>

            <WebhookEventsTable />
          </div>
        </div>
      </RequireTenant>
    </DashboardLayout>
  );
};

export default WebhookEvents;
