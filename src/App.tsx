import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { useCSRF } from "@/hooks/useCSRF";
import ProtectedRoute from "@/components/ProtectedRoute";
import SuperAdminRoute from "@/components/SuperAdminRoute";
import { PlatformLayout } from "@/components/PlatformLayout";
import { PermissionGate } from "@/components/PermissionGate";
import { SecurityGuard } from "@/components/SecurityGuard";
import Index from "./pages/Index";
import SuperAdminDashboard from "./pages/admin/SuperAdminDashboard";
import TenantManagement from "./pages/admin/TenantManagement";
import PlatformSecurity from "./pages/admin/PlatformSecurity";
import PlatformProviders from "./pages/admin/PlatformProviders";
import PlatformEvents from "./pages/admin/PlatformEvents";
import PlatformWebhooks from "./pages/admin/PlatformWebhooks";
import PlatformDisputes from "./pages/admin/PlatformDisputes";
import PlatformRefunds from "./pages/admin/PlatformRefunds";
import PlatformSettings from "./pages/admin/PlatformSettings";
import PlatformImpersonate from "./pages/admin/PlatformImpersonate";
import PlatformStatus from "./pages/admin/PlatformStatus";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import TwoFactorVerification from "./pages/TwoFactorVerification";
import MfaChallenge from "./pages/MfaChallenge";
import MfaEnroll from "./pages/auth/MfaEnroll";
import PasswordChange from "./pages/auth/PasswordChange";
import ClaimCode from "./pages/auth/ClaimCode";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import Payments from "./pages/Payments";
import Refunds from "./pages/Refunds";
import Customers from "./pages/Customers";
import WebhookEvents from "./pages/WebhookEvents";
import Settlements from "./pages/Settlements";
import Links from "./pages/Links";
import Reports from "./pages/Reports";
import AdminUsers from "./pages/AdminUsers";
import Status from "./pages/Status";
import Workbench from "./pages/Workbench";
import NotFound from "./pages/NotFound";
import PayLink from "./pages/PayLink";
import PayLinkSuccess from "./pages/PayLinkSuccess";
import Docs from "./pages/Docs";
import GoLive from "./pages/GoLive";
import DepositList from "./pages/DepositList";
import WithdrawalList from "./pages/WithdrawalList";
import SystemDeposit from "./pages/SystemDeposit";
import SystemWithdrawal from "./pages/SystemWithdrawal";
import MDR from "./pages/MDR";

import ActivityHistory from "./pages/ActivityHistory";
import PaymentMethods from "./pages/PaymentMethods";
import Products from "./pages/Products";
import Reconciliation from "./pages/Reconciliation";
import Disputes from "./pages/Disputes";
import KYCVerification from "./pages/KYCVerification";
import CreateSuperAdmin from "./pages/CreateSuperAdmin";
import ResetSuperAdminPassword from "./pages/ResetSuperAdminPassword";
import BootstrapTest from "./pages/BootstrapTest";
import TwoFactorChecklist from "./pages/TwoFactorChecklist";
import Approvals from "./pages/Approvals";
import PlatformAudit from "./pages/admin/PlatformAudit";
import GoLiveControls from "./pages/GoLiveControls";
import PyramidAuthority from "./pages/PyramidAuthority";
import AlertManagement from "./pages/AlertManagement";
import GapReport from "./pages/GapReport";
import AuthStatus from "./pages/AuthStatus";
import TestingGuide from "./pages/TestingGuide";
import { ShareholderRoute } from "./components/ShareholderRoute";
import ShareholderLayout from "./components/layouts/ShareholderLayout";
import ShareholderTeam from "./pages/shareholder/ShareholderTeam";
import ShareholderSettings from "./pages/shareholder/ShareholderSettings";
import ShareholderDashboard from "./pages/shareholder/ShareholderDashboard";
import ShareholderClients from "./pages/shareholder/ShareholderClients";
import ShareholderEarnings from "./pages/shareholder/ShareholderEarnings";
import ShareholderWithdrawals from "./pages/shareholder/ShareholderWithdrawals";
import FirstLogin2FASetup from "./pages/auth/FirstLogin2FASetup";
import FirstLoginPasswordChange from "./pages/auth/FirstLoginPasswordChange";
import PlatformPartners from "./pages/admin/PlatformPartners";
import PlatformPartnerDetail from "./pages/admin/PlatformPartnerDetail";
import PlatformPartnerPayouts from "./pages/admin/PlatformPartnerPayouts";
import PlatformPartnerReports from "./pages/admin/PlatformPartnerReports";
import PlatformPartnerSettings from "./pages/admin/PlatformPartnerSettings";
import PlatformShareholderEarnings from "./pages/admin/PlatformShareholderEarnings";
import TransactionDashboard from "./pages/TransactionDashboard";

const queryClient = new QueryClient();

function AppContent() {
  useCSRF(); // Initialize CSRF protection

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/auth/sign-in" element={<SignIn />} />
      <Route path="/auth/sign-up" element={<SignUp />} />
      <Route path="/auth/two-factor" element={<TwoFactorVerification />} />
      <Route path="/auth/mfa-challenge" element={<MfaChallenge />} />
      <Route path="/auth/mfa-enroll" element={<MfaEnroll />} />
      <Route path="/auth/password-change" element={<PasswordChange />} />
      <Route path="/auth/claim-code" element={<ClaimCode />} />
      <Route path="/auth/create-super-admin" element={<CreateSuperAdmin />} />
      <Route path="/auth/reset-super-admin" element={<ResetSuperAdminPassword />} />
      <Route path="/auth/bootstrap-test" element={<BootstrapTest />} />
      <Route path="/first-login/2fa-setup" element={<FirstLogin2FASetup />} />
      <Route path="/first-login/change-password" element={<FirstLoginPasswordChange />} />
      <Route path="/auth" element={<Navigate to="/auth/sign-in" replace />} />
      
      <Route path="/setup/super-admin" element={<CreateSuperAdmin />} />
      
      <Route path="/status" element={<Status />} />
      <Route path="/workbench" element={<Workbench />} />
      <Route path="/approvals" element={<Approvals />} />
      <Route path="/go-live/controls" element={<GoLiveControls />} />
      
      <Route path="/pay/:slug" element={<PayLink />} />
      <Route path="/pay/:slug/success" element={<PayLinkSuccess />} />
      
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/payments"
        element={
          <ProtectedRoute>
            <Payments />
          </ProtectedRoute>
        }
      />
      {/* Alias: support singular path */}
      <Route path="/payment" element={<Navigate to="/payments" replace />} />
      <Route
        path="/refunds"
        element={
          <ProtectedRoute>
            <Refunds />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customers"
        element={
          <ProtectedRoute>
            <Customers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/webhook-events"
        element={
          <ProtectedRoute>
            <WebhookEvents />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settlements"
        element={
          <ProtectedRoute>
            <Settlements />
          </ProtectedRoute>
        }
      />
      <Route
        path="/links"
        element={
          <ProtectedRoute>
            <Links />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <Reports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/docs"
        element={
          <ProtectedRoute>
            <Docs />
          </ProtectedRoute>
        }
      />
      <Route
        path="/testing-guide"
        element={
          <ProtectedRoute>
            <TestingGuide />
          </ProtectedRoute>
        }
      />
      <Route
        path="/go-live"
        element={
          <ProtectedRoute>
            <GoLive />
          </ProtectedRoute>
        }
      />
      <Route
        path="/deposit-list"
        element={
          <ProtectedRoute>
            <DepositList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/withdrawal-list"
        element={
          <ProtectedRoute>
            <WithdrawalList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/system-deposit"
        element={
          <ProtectedRoute>
            <PermissionGate allowOwner fallback={<Navigate to="/dashboard" replace />}> 
              <SystemDeposit />
            </PermissionGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/system-withdrawal"
        element={
          <ProtectedRoute>
            <PermissionGate allowOwner fallback={<Navigate to="/dashboard" replace />}> 
              <SystemWithdrawal />
            </PermissionGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/mdr"
        element={
          <ProtectedRoute>
            <MDR />
          </ProtectedRoute>
        }
      />
      <Route
        path="/transactions-dashboard"
        element={
          <ProtectedRoute>
            <TransactionDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/activity-history"
        element={
          <ProtectedRoute>
            <ActivityHistory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/payment-methods"
        element={
          <ProtectedRoute>
            <PaymentMethods />
          </ProtectedRoute>
        }
      />
      <Route
        path="/products"
        element={
          <ProtectedRoute>
            <Products />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reconciliation"
        element={
          <ProtectedRoute>
            <Reconciliation />
          </ProtectedRoute>
        }
      />
      <Route
        path="/disputes"
        element={
          <ProtectedRoute>
            <Disputes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/kyc-verification"
        element={
          <ProtectedRoute>
            <KYCVerification />
          </ProtectedRoute>
        }
      />
      <Route
        path="/go-live/2fa-checklist"
        element={
          <ProtectedRoute>
            <TwoFactorChecklist />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <SuperAdminRoute>
            <PlatformLayout>
              <SuperAdminDashboard />
            </PlatformLayout>
          </SuperAdminRoute>
        }
      />
      <Route
        path="/admin/tenants"
        element={
          <SuperAdminRoute>
            <PlatformLayout>
              <TenantManagement />
            </PlatformLayout>
          </SuperAdminRoute>
        }
      />
      <Route
        path="/platform/security"
        element={
          <SuperAdminRoute>
            <PlatformLayout>
              <PlatformSecurity />
            </PlatformLayout>
          </SuperAdminRoute>
        }
      />
      <Route
        path="/platform/partners"
        element={
          <SuperAdminRoute>
            <PlatformLayout>
              <PlatformPartners />
            </PlatformLayout>
          </SuperAdminRoute>
        }
      />
      <Route
        path="/platform/partners/:id"
        element={
          <SuperAdminRoute>
            <PlatformLayout>
              <PlatformPartnerDetail />
            </PlatformLayout>
          </SuperAdminRoute>
        }
      />
      <Route
        path="/platform/partner-payouts"
        element={
          <SuperAdminRoute>
            <PlatformLayout>
              <PlatformPartnerPayouts />
            </PlatformLayout>
          </SuperAdminRoute>
        }
      />
      <Route
        path="/platform/partner-reports"
        element={
          <SuperAdminRoute>
            <PlatformLayout>
              <PlatformPartnerReports />
            </PlatformLayout>
          </SuperAdminRoute>
        }
      />
      <Route
        path="/platform/partner-settings"
        element={
          <SuperAdminRoute>
            <PlatformLayout>
              <PlatformPartnerSettings />
            </PlatformLayout>
          </SuperAdminRoute>
        }
      />
      <Route
        path="/platform/shareholder-earnings"
        element={
          <SuperAdminRoute>
            <PlatformLayout>
              <PlatformShareholderEarnings />
            </PlatformLayout>
          </SuperAdminRoute>
        }
      />
      <Route
        path="/platform/audit"
        element={
          <SuperAdminRoute>
            <PlatformLayout>
              <PlatformAudit />
            </PlatformLayout>
          </SuperAdminRoute>
        }
      />
      <Route path="/platform/providers" element={<SuperAdminRoute><PlatformLayout><PlatformProviders /></PlatformLayout></SuperAdminRoute>} />
      <Route path="/platform/events" element={<SuperAdminRoute><PlatformLayout><PlatformEvents /></PlatformLayout></SuperAdminRoute>} />
      <Route path="/platform/webhooks" element={<SuperAdminRoute><PlatformLayout><PlatformWebhooks /></PlatformLayout></SuperAdminRoute>} />
      <Route path="/platform/disputes" element={<SuperAdminRoute><PlatformLayout><PlatformDisputes /></PlatformLayout></SuperAdminRoute>} />
      <Route path="/platform/refunds" element={<SuperAdminRoute><PlatformLayout><PlatformRefunds /></PlatformLayout></SuperAdminRoute>} />
      <Route path="/platform/settings" element={<SuperAdminRoute><PlatformLayout><PlatformSettings /></PlatformLayout></SuperAdminRoute>} />
      <Route path="/platform/impersonate" element={<SuperAdminRoute><PlatformLayout><PlatformImpersonate /></PlatformLayout></SuperAdminRoute>} />
      <Route path="/platform/status" element={<SuperAdminRoute><PlatformLayout><PlatformStatus /></PlatformLayout></SuperAdminRoute>} />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute>
            <AdminUsers />
          </ProtectedRoute>
        }
      />
      <Route path="/pyramid-authority" element={<ProtectedRoute><PyramidAuthority /></ProtectedRoute>} />
      <Route path="/alerts" element={<ProtectedRoute><AlertManagement /></ProtectedRoute>} />
      <Route path="/reports/gap" element={<ProtectedRoute><GapReport /></ProtectedRoute>} />
      
      {/* Shareholder Routes */}
      <Route
        path="/shareholder"
        element={
          <ProtectedRoute>
            <ShareholderRoute>
              <ShareholderLayout />
            </ShareholderRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/shareholder/dashboard" replace />} />
        <Route path="dashboard" element={<ShareholderDashboard />} />
        <Route path="clients" element={<ShareholderClients />} />
        <Route path="earnings" element={<ShareholderEarnings />} />
        <Route path="withdrawals" element={<ShareholderWithdrawals />} />
        <Route path="team" element={<ShareholderTeam />} />
        <Route path="settings" element={<ShareholderSettings />} />
      </Route>

      {/* Legacy Shareholder Routes - Redirect to new structure */}
      <Route path="/shareholder/overview" element={<Navigate to="/shareholder/dashboard" replace />} />
      <Route path="/shareholder/reports" element={<Navigate to="/shareholder/earnings" replace />} />
      <Route path="/shareholder/reports/:ownerId" element={<Navigate to="/shareholder/earnings" replace />} />
      
      {/* Auth Status Test Page */}
      <Route path="/auth-status" element={<ProtectedRoute><AuthStatus /></ProtectedRoute>} />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
