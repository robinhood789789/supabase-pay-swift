import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Loader2 } from "lucide-react";
import { useCreateTenant } from "@/hooks/useCreateTenant";
import { useAuth } from "@/hooks/useAuth";

export const OrganizationSetup = () => {
  const [businessName, setBusinessName] = useState("");
  const { user } = useAuth();
  const createTenantMutation = useCreateTenant();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      return;
    }

    // Validate business name
    if (!businessName.trim()) {
      return;
    }

    if (businessName.length > 100) {
      return;
    }

    createTenantMutation.mutate(
      {
        user_id: user.id,
        email: user.email!,
        business_name: businessName.trim(),
      },
      {
        onSuccess: () => {
          // Refresh the page to update tenant switcher
          window.location.reload();
        },
      }
    );
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <CardTitle>Create Your Workspace</CardTitle>
            <CardDescription>
              Set up your organization to start managing payments
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="businessName">Business Name *</Label>
            <Input
              id="businessName"
              placeholder="Enter your business name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              maxLength={100}
              required
              disabled={createTenantMutation.isPending}
            />
            <p className="text-sm text-muted-foreground">
              This will be your workspace name
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={!businessName.trim() || createTenantMutation.isPending}
              className="gap-2"
            >
              {createTenantMutation.isPending && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              Create Workspace
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
