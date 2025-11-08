import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invokeFunctionWithTenant } from "@/lib/supabaseFunctions";
import { toast } from "sonner";

interface CreateTenantInput {
  user_id: string;
  email: string;
  business_name: string;
}

interface CreateTenantResponse {
  success: boolean;
  tenant: {
    id: string;
    name: string;
    status: string;
    created_at: string;
  };
  role: {
    id: string;
    name: string;
  };
  membership: {
    id: string;
  };
}

export const useCreateTenant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTenantInput) => {
      console.log('Calling create-tenant-on-signup function');
      
      const { data, error } = await invokeFunctionWithTenant('create-tenant-on-signup', {
        body: input,
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to create tenant');
      }

      if (data.error) {
        console.error('Tenant creation error:', data.error);
        throw new Error(data.error);
      }

      return data as CreateTenantResponse;
    },
    onSuccess: (data) => {
      console.log('Tenant created successfully:', data.tenant.id);
      toast.success('Workspace created successfully!', {
        description: `Welcome to ${data.tenant.name}`,
      });
      
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['user-role'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: Error) => {
      console.error('Tenant creation failed:', error);
      toast.error('Failed to create workspace', {
        description: error.message,
      });
    },
  });
};
