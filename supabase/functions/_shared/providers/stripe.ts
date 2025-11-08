import type { 
  PaymentProvider, 
  CheckoutSessionParams, 
  CheckoutSessionResponse,
  PaymentStatusResponse,
  RefundResponse 
} from "../paymentProvider.ts";

export class StripeProvider implements PaymentProvider {
  name = "stripe";
  private apiKey: string;
  private apiVersion = "2023-10-16";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResponse> {
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": this.apiVersion,
      },
      body: new URLSearchParams({
        "mode": "payment",
        "line_items[0][price_data][currency]": params.currency.toLowerCase(),
        "line_items[0][price_data][product_data][name]": "Payment",
        "line_items[0][price_data][unit_amount]": params.amount.toString(),
        "line_items[0][quantity]": "1",
        "success_url": params.successUrl || "https://example.com/success",
        "cancel_url": params.cancelUrl || "https://example.com/cancel",
        ...(params.reference ? { "client_reference_id": params.reference } : {}),
      }).toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Stripe API error: ${error}`);
    }

    const session = await response.json();

    return {
      providerSessionId: session.id,
      redirectUrl: session.url,
      expiresAt: new Date(session.expires_at * 1000).toISOString(),
      status: session.status,
    };
  }

  async getPaymentStatus(providerSessionId: string): Promise<PaymentStatusResponse> {
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${providerSessionId}`, {
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Stripe-Version": this.apiVersion,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Stripe API error: ${error}`);
    }

    const session = await response.json();

    return {
      id: session.id,
      status: session.payment_status,
      amount: session.amount_total,
      currency: session.currency,
      paidAt: session.payment_status === "paid" ? new Date().toISOString() : undefined,
      metadata: session.metadata,
    };
  }

  async refund(paymentId: string, amount: number, reason?: string): Promise<RefundResponse> {
    const response = await fetch("https://api.stripe.com/v1/refunds", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": this.apiVersion,
      },
      body: new URLSearchParams({
        "payment_intent": paymentId,
        "amount": amount.toString(),
        ...(reason ? { "reason": reason } : {}),
      }).toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Stripe API error: ${error}`);
    }

    const refund = await response.json();

    return {
      refundId: refund.id,
      status: refund.status,
      amount: refund.amount,
    };
  }
}
