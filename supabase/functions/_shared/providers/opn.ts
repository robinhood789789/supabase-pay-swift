import type { 
  PaymentProvider, 
  CheckoutSessionParams, 
  CheckoutSessionResponse,
  PaymentStatusResponse,
  RefundResponse 
} from "../paymentProvider.ts";

export class OpnProvider implements PaymentProvider {
  name = "opn";
  private apiKey: string;
  private apiUrl = "https://api.omise.co";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private getAuthHeader(): string {
    const encoded = btoa(`${this.apiKey}:`);
    return `Basic ${encoded}`;
  }

  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResponse> {
    // Create a charge with Omise API
    const response = await fetch(`${this.apiUrl}/charges`, {
      method: "POST",
      headers: {
        "Authorization": this.getAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: params.amount,
        currency: params.currency.toUpperCase(),
        description: params.reference || "Payment",
        return_uri: params.successUrl || "https://example.com/success",
        metadata: {
          tenant_id: params.tenantId,
          reference: params.reference,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OPN API error: ${error}`);
    }

    const charge = await response.json();

    return {
      providerSessionId: charge.id,
      redirectUrl: charge.authorize_uri,
      status: charge.status === "pending" ? "pending" : "completed",
    };
  }

  async getPaymentStatus(providerSessionId: string): Promise<PaymentStatusResponse> {
    const response = await fetch(`${this.apiUrl}/charges/${providerSessionId}`, {
      headers: {
        "Authorization": this.getAuthHeader(),
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OPN API error: ${error}`);
    }

    const charge = await response.json();

    return {
      id: charge.id,
      status: charge.paid ? "paid" : charge.status,
      amount: charge.amount,
      currency: charge.currency,
      paidAt: charge.paid ? charge.paid_at : undefined,
      metadata: charge.metadata,
    };
  }

  async refund(paymentId: string, amount: number, reason?: string): Promise<RefundResponse> {
    const response = await fetch(`${this.apiUrl}/charges/${paymentId}/refunds`, {
      method: "POST",
      headers: {
        "Authorization": this.getAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amount,
        ...(reason ? { metadata: { reason } } : {}),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OPN API error: ${error}`);
    }

    const refund = await response.json();

    return {
      refundId: refund.id,
      status: refund.status || "pending",
      amount: refund.amount,
    };
  }
}
