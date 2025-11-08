import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantSwitcher } from "./useTenantSwitcher";

export const usePermissions = () => {
  const { user } = useAuth();
  const { activeTenantId } = useTenantSwitcher();

  const { data: permissions = [], isLoading: queryLoading } = useQuery({
    queryKey: ["user-permissions", user?.id, activeTenantId],
    queryFn: async () => {
      if (!user?.id || !activeTenantId) return [];

      // Get user's role in active tenant
      const { data: membership, error: membershipError } = await supabase
        .from("memberships")
        .select("role_id")
        .eq("user_id", user.id)
        .eq("tenant_id", activeTenantId)
        .maybeSingle();

      if (membershipError || !membership) return [];

      // Get permissions for this role (fetch IDs then names to avoid FK dependency)
      const { data: rolePerms, error: rolePermsError } = await supabase
        .from("role_permissions")
        .select("permission_id")
        .eq("role_id", membership.role_id);

      if (rolePermsError || !rolePerms) return [];

      const permissionIds = rolePerms.map((rp) => rp.permission_id).filter(Boolean);
      if (permissionIds.length === 0) return [];

      const { data: perms, error: permsError } = await supabase
        .from("permissions")
        .select("name")
        .in("id", permissionIds);

      if (permsError || !perms) return [];

      return perms.map((p) => p.name);
    },
    enabled: !!user?.id && !!activeTenantId,
  });

  const isLoading = queryLoading || !activeTenantId;

  const hasPermission = (permission: string): boolean => {
    return permissions.includes(permission);
  };

  const hasAnyPermission = (permissionList: string[]): boolean => {
    return permissionList.some((p) => permissions.includes(p));
  };

  const hasAllPermissions = (permissionList: string[]): boolean => {
    return permissionList.every((p) => permissions.includes(p));
  };

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isLoading,
  };
};
