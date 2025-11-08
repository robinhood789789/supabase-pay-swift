import { useTenantSwitcher } from "./useTenantSwitcher";
import { useAuth } from "./useAuth";

export type UserRole = 'owner' | 'manager' | 'finance' | 'developer' | 'viewer';

export const useRoleVisibility = () => {
  const { activeTenant } = useTenantSwitcher();
  const { isSuperAdmin } = useAuth();
  
  const currentRole = activeTenant?.roles?.name as UserRole | undefined;
  
  // Owner sees everything
  const isOwner = currentRole === 'owner';
  const isManager = currentRole === 'manager';
  const isFinance = currentRole === 'finance';
  const isDeveloper = currentRole === 'developer';
  const isViewer = currentRole === 'viewer';
  
  return {
    currentRole,
    isOwner,
    isManager,
    isFinance,
    isDeveloper,
    isViewer,
    isSuperAdmin,
    
    // Widget visibility - Viewer can view financial data (read-only)
    canViewFinancialOverview: isOwner || isManager || isFinance || isViewer,
    canViewPayments: isOwner || isManager || isFinance || isViewer,
    canViewPayouts: isOwner || isManager || isFinance || isViewer,
    canViewApprovals: isOwner || isManager,
    canViewRiskAlerts: isOwner || isManager,
    canViewAPIMetrics: isOwner || isDeveloper || isManager,
    canViewWebhooks: isOwner || isDeveloper || isManager,
    
    // Quick actions - Viewer cannot perform any actions (read-only)
    canCreatePayout: isOwner || isManager || isFinance,
    canApprovePayout: isOwner || isManager,
    canCreatePaymentLink: isOwner || isManager,
    canManageAPIKeys: isOwner || isDeveloper,
    canTestWebhooks: isOwner || isDeveloper,
    canExportData: isOwner || isManager || isFinance,
  };
};
