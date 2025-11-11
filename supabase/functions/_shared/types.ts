// Shared TypeScript types/interfaces for Edge Functions

// ============================================================================
// Base Response Types
// ============================================================================

export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, any>;
}

export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;

// ============================================================================
// Pagination Types
// ============================================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ============================================================================
// Authentication & User Types
// ============================================================================

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role?: string;
  tenantId?: string;
}

export interface UserCreateRequest {
  email: string;
  password?: string;
  role?: string;
  metadata?: Record<string, any>;
}

export interface UserUpdateRequest {
  email?: string;
  password?: string;
  role?: string;
  metadata?: Record<string, any>;
}

export interface MfaEnrollRequest {
  userId: string;
  method: 'totp' | 'sms';
}

export interface MfaVerifyRequest {
  userId: string;
  code: string;
  challengeId?: string;
}

export interface MfaChallengeResponse {
  challengeId: string;
  expiresAt: string;
}

export interface PasswordChangeRequest {
  currentPassword?: string;
  newPassword: string;
  confirmPassword?: string;
}

// ============================================================================
// Tenant & Membership Types
// ============================================================================

export interface TenantContext {
  tenantId: string;
  userId: string;
  role?: string;
  permissions?: string[];
}

export interface CreateTenantRequest {
  name: string;
  type?: string;
  metadata?: Record<string, any>;
}

export interface UpdateTenantRequest {
  name?: string;
  status?: string;
  settings?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface MembershipRequest {
  userId: string;
  tenantId: string;
  role: string;
}

// ============================================================================
// Payment Types
// ============================================================================

export interface CheckoutSessionRequest {
  amount: number;
  currency: string;
  reference?: string;
  successUrl?: string;
  cancelUrl?: string;
  methodTypes: string[];
  tenantId: string;
  metadata?: Record<string, any>;
}

export interface CheckoutSessionResponse {
  sessionId: string;
  providerSessionId: string;
  redirectUrl?: string;
  qrImageUrl?: string;
  expiresAt?: string;
  status: string;
}

export interface PaymentStatusRequest {
  paymentId: string;
  providerSessionId?: string;
}

export interface PaymentStatusResponse {
  id: string;
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'refunded';
  amount: number;
  currency: string;
  paidAt?: string;
  metadata?: Record<string, any>;
}

export interface RefundRequest {
  paymentId: string;
  amount?: number;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface RefundResponse {
  refundId: string;
  status: string;
  amount: number;
  processedAt?: string;
}

export interface PaymentLinkRequest {
  amount: number;
  currency: string;
  description?: string;
  expiresAt?: string;
  maxUses?: number;
  metadata?: Record<string, any>;
}

export interface PaymentLinkResponse {
  id: string;
  shortCode: string;
  url: string;
  qrCode?: string;
  expiresAt?: string;
  status: string;
}

// ============================================================================
// Settlement & Reconciliation Types
// ============================================================================

export interface SettlementRequest {
  provider: string;
  cycle: string;
  amount: number;
  fees?: number;
  netAmount: number;
  paidOutAt?: string;
  metadata?: Record<string, any>;
}

export interface ReconciliationRequest {
  provider: string;
  cycle: string;
  file: File | Blob;
  dateWindowDays?: number;
}

export interface ReconciliationResult {
  matched: number;
  unmatched: number;
  discrepancies: Array<{
    row: number;
    amount: number;
    reference?: string;
    date?: string;
    reason: string;
  }>;
  settlementId?: string;
}

// ============================================================================
// Webhook Types
// ============================================================================

export interface WebhookEvent {
  id: string;
  type: string;
  provider: string;
  payload: Record<string, any>;
  signature?: string;
  receivedAt: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  url: string;
  payload: Record<string, any>;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  lastAttemptAt?: string;
  nextRetryAt?: string;
}

export interface WebhookRetryRequest {
  deliveryId: string;
  maxAttempts?: number;
}

// ============================================================================
// API Key Types
// ============================================================================

export interface ApiKeyCreateRequest {
  name: string;
  expiresAt?: string;
  scopes?: string[];
  metadata?: Record<string, any>;
}

export interface ApiKeyResponse {
  id: string;
  key?: string; // Only returned on creation
  name: string;
  prefix: string;
  expiresAt?: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string;
}

export interface ApiKeyRevokeRequest {
  keyId: string;
  reason?: string;
}

// ============================================================================
// Security & Monitoring Types
// ============================================================================

export interface SecurityEvent {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface IpBlockRequest {
  ipAddress: string;
  reason: string;
  durationMinutes?: number;
  isPermanent?: boolean;
  expiresAt?: string;
  severity?: string;
  metadata?: Record<string, any>;
}

export interface IpUnblockRequest {
  ipAddress: string;
  reason?: string;
}

export interface IpBlockResponse {
  id: string;
  ipAddress: string;
  reason: string;
  blockedAt: string;
  expiresAt?: string;
  status: string;
}

export interface ActivityLogEntry {
  id: string;
  userId: string;
  tenantId?: string;
  action: string;
  resource?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// ============================================================================
// Shareholder & Partner Types
// ============================================================================

export interface ShareholderCreateRequest {
  name: string;
  email: string;
  commissionRate: number;
  type?: string;
  metadata?: Record<string, any>;
}

export interface ShareholderAdjustmentRequest {
  shareholderId: string;
  amount: number;
  reason: string;
  type: 'credit' | 'debit';
  metadata?: Record<string, any>;
}

export interface ShareholderPayoutRequest {
  shareholderId: string;
  amount: number;
  method?: string;
  metadata?: Record<string, any>;
}

export interface PartnerCreateRequest {
  name: string;
  email: string;
  commissionRate: number;
  type?: string;
  settings?: Record<string, any>;
}

export interface PartnerCommissionUpdateRequest {
  partnerId: string;
  commissionRate: number;
  effectiveFrom?: string;
}

// ============================================================================
// Report & Export Types
// ============================================================================

export interface ReportRequest {
  startDate: string;
  endDate: string;
  type?: string;
  format?: 'json' | 'csv' | 'pdf';
  filters?: Record<string, any>;
}

export interface ExportRequest {
  entityType: string;
  filters?: Record<string, any>;
  format: 'csv' | 'json' | 'xlsx';
  columns?: string[];
}

export interface ExportResponse {
  url?: string;
  filename?: string;
  data?: any;
  format: string;
  recordCount: number;
  generatedAt: string;
}

// ============================================================================
// Approval & Workflow Types
// ============================================================================

export interface ApprovalRequest {
  actionType: string;
  actionData: any;
  amount?: number;
  reason: string;
}

export interface ApprovalDecision {
  approvalId: string;
  action: 'approve' | 'reject';
  reason?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// Deposit & Withdrawal Types
// ============================================================================

export interface DepositRequest {
  amount: number;
  currency: string;
  method?: string;
  reference?: string;
  metadata?: Record<string, any>;
}

export interface WithdrawalRequest {
  amount: number;
  currency: string;
  method?: string;
  destination?: string;
  metadata?: Record<string, any>;
}

export interface TransactionRequest {
  type: 'deposit' | 'withdrawal' | 'transfer';
  amount: number;
  currency: string;
  reference?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// Temporary Code Types
// ============================================================================

export interface TemporaryCodeGenerate {
  userId: string;
  purpose: string;
  expiresIn?: number; // seconds
  metadata?: Record<string, any>;
}

export interface TemporaryCodeResponse {
  code: string;
  expiresAt: string;
  purpose: string;
}

export interface TemporaryCodeClaim {
  code: string;
  userId?: string;
}

// ============================================================================
// Alert & Notification Types
// ============================================================================

export interface AlertRule {
  id: string;
  type: string;
  conditions: Record<string, any>;
  actions: Array<{
    type: string;
    config: Record<string, any>;
  }>;
  enabled: boolean;
}

export interface AlertEvaluation {
  ruleId: string;
  triggered: boolean;
  value?: any;
  threshold?: any;
  timestamp: string;
}
