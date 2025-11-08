import type { 
  PaymentProvider, 
  CheckoutSessionParams, 
  CheckoutSessionResponse,
  PaymentStatusResponse,
  RefundResponse 
} from "../paymentProvider.ts";

export class KBankProvider implements PaymentProvider {
  name = "kbank";
  private apiKey: string;
  private merchantId: string;
  private apiUrl = "https://dev-kpaymentgateway.kasikornbank.com/ui/v2";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.merchantId = Deno.env.get("KBANK_MERCHANT_ID") || "";
  }

  private async generateToken(): Promise<string> {
    // KBank uses OAuth2 for authentication
    const response = await fetch(`${this.apiUrl}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${this.merchantId}:${this.apiKey}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
      }).toString(),
    });

    if (!response.ok) {
      throw new Error("Failed to get KBank access token");
    }

    const result = await response.json();
    return result.access_token;
  }

  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResponse> {
    const token = await this.generateToken();
    const transactionId = `TXN${Date.now()}`;

    const payload = {
      merchantId: this.merchantId,
      transactionId: transactionId,
      amount: (params.amount / 100).toFixed(2),
      currency: params.currency,
      description: params.reference || "Payment",
      paymentMethods: params.methodTypes,
      responseUrl: params.successUrl || "https://example.com/success",
      backgroundUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/webhooks-kbank`,
      metadata: {
        tenant_id: params.tenantId,
      },
    };

    const response = await fetch(`${this.apiUrl}/payment`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`KBank API error: ${error}`);
    }

    const result = await response.json();

    return {
      providerSessionId: result.transactionId || transactionId,
      redirectUrl: result.paymentUrl,
      qrImageUrl: result.qrCode,
      status: "pending",
      expiresAt: result.expiresAt,
    };
  }

  async getPaymentStatus(providerSessionId: string): Promise<PaymentStatusResponse> {
    const token = await this.generateToken();

    const response = await fetch(
      `${this.apiUrl}/payment/${this.merchantId}/${providerSessionId}`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`KBank API error: ${error}`);
    }

    const result = await response.json();

    const statusMap: Record<string, string> = {
      "00": "paid",
      "01": "pending",
      "02": "failed",
      "03": "expired",
    };

    return {
      id: providerSessionId,
      status: statusMap[result.responseCode] || "pending",
      amount: parseFloat(result.amount) * 100,
      currency: result.currency,
      paidAt: result.responseCode === "00" ? result.transactionDate : undefined,
      metadata: result,
    };
  }

  async refund(paymentId: string, amount: number, reason?: string): Promise<RefundResponse> {
    const token = await this.generateToken();

    const payload = {
      merchantId: this.merchantId,
      originalTransactionId: paymentId,
      refundAmount: (amount / 100).toFixed(2),
      reason: reason || "Refund requested",
    };

    const response = await fetch(`${this.apiUrl}/refund`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`KBank API error: ${error}`);
    }

    const result = await response.json();

    return {
      refundId: result.refundTransactionId || crypto.randomUUID(),
      status: result.responseCode === "00" ? "succeeded" : "pending",
      amount: amount,
    };
  }
}
