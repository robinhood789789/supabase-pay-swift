import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { RequireTenant } from "@/components/RequireTenant";

export default function Products() {
  return (
    <RequireTenant>
      <DashboardLayout>
        <div className="max-w-4xl mx-auto p-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Products feature is currently unavailable. The database schema for products has not been implemented yet.
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    </RequireTenant>
  );
}
