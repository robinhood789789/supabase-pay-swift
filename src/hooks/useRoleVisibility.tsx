import { useTenantSwitcher } from "./useTenantSwitcher";
import { useAuth } from "./useAuth";
import { usePermissions } from "./usePermissions";

export type UserRole = 'owner' | 'manager' | 'finance' | 'developer' | 'viewer';

/**
 * Hook for checking user visibility and action permissions
 * Now uses the permissions system instead of direct role checks
 * Maintains backward compatibility with existing components
 */
export const useRoleVisibility = () => {
  const { activeTenant } = useTenantSwitcher();
  const { isSuperAdmin } = useAuth();
  const { hasPermission, hasAnyPermission, isLoading } = usePermissions();
  
  const currentRole = activeTenant?.roles?.name as UserRole | undefined;
  
  // Role flags for backward compatibility
  const isOwner = currentRole === 'owner';
  const isManager = currentRole === 'manager';
  const isFinance = currentRole === 'finance';
  const isDeveloper = currentRole === 'developer';
  const isViewer = currentRole === 'viewer';
  
  // Permission-based visibility checks
  // Widget visibility
  const canViewFinancialOverview = hasAnyPermission([
    'dashboard.view',
    'payments.view',
    'settlements.view'
  ]);
  
  const canViewPayments = hasPermission('payments.view');
  
  const canViewPayouts = hasAnyPermission([
    'payments.view',
    'settlements.view'
  ]);
  
  const canViewApprovals = hasPermission('approvals.view');
  
  const canViewRiskAlerts = hasPermission('alerts.view');
  
  const canViewAPIMetrics = hasAnyPermission([
    'api_keys.view',
    'webhooks.view'
  ]);
  
  const canViewWebhooks = hasPermission('webhooks.view');
  
  // Action permissions
  const canCreatePayout = hasPermission('payments.create');
  
  const canApprovePayout = hasPermission('approvals.decide');
  
  const canCreatePaymentLink = hasPermission('payment_links.create');
  
  const canManageAPIKeys = hasPermission('api_keys.manage');
  
  const canTestWebhooks = hasPermission('webhooks.test');
  
  const canExportData = hasPermission('payments.export');
  
  return {
    currentRole,
    isOwner,
    isManager,
    isFinance,
    isDeveloper,
    isViewer,
    isSuperAdmin,
    isLoading,
    
    // Widget visibility
    canViewFinancialOverview,
    canViewPayments,
    canViewPayouts,
    canViewApprovals,
    canViewRiskAlerts,
    canViewAPIMetrics,
    canViewWebhooks,
    
    // Quick actions
    canCreatePayout,
    canApprovePayout,
    canCreatePaymentLink,
    canManageAPIKeys,
    canTestWebhooks,
    canExportData,
  };
};
