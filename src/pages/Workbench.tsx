import DashboardLayout from "@/components/DashboardLayout";
import { RequireTenant } from "@/components/RequireTenant";
import { AdminWorkbench } from "@/components/AdminWorkbench";

const Workbench = () => {
  return (
    <DashboardLayout>
      <RequireTenant>
        <AdminWorkbench />
      </RequireTenant>
    </DashboardLayout>
  );
};

export default Workbench;
