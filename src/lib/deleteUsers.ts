import { invokeFunctionWithTenant } from "./supabaseFunctions";

export const deleteUsersCompletely = async (userIds: string[], tenantId: string) => {
  const { data, error } = await invokeFunctionWithTenant('admin-delete-users-completely', {
    body: { user_ids: userIds, tenant_id: tenantId }
  });

  if (error) {
    throw new Error(error.message || 'Failed to delete users');
  }

  return data;
};
