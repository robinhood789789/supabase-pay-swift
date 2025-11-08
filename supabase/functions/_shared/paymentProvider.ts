// Payment provider interface and types

export interface CheckoutSessionParams {
  amount: number;
  currency: string;
  reference?: string;
  successUrl?: string;
  cancelUrl?: string;
  methodTypes: string[];
  tenantId: string;
}

export interface CheckoutSessionResponse {
  providerSessionId: string;
  redirectUrl?: string;
  qrImageUrl?: string;
  expiresAt?: string;
  status: string;
}

export interface PaymentStatusResponse {
  id: string;
  status: string;
  amount: number;
  currency: string;
  paidAt?: string;
  metadata?: Record<string, any>;
}

export interface RefundResponse {
  refundId: string;
  status: string;
  amount: number;
}

export interface PaymentProvider {
  name: string;
  
  createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResponse>;
  
  getPaymentStatus(providerSessionId: string): Promise<PaymentStatusResponse>;
  
  refund(paymentId: string, amount: number, reason?: string): Promise<RefundResponse>;
}
