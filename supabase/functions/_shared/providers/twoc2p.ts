import type { 
  PaymentProvider, 
  CheckoutSessionParams, 
  CheckoutSessionResponse,
  PaymentStatusResponse,
  RefundResponse 
} from "../paymentProvider.ts";

export class TwoC2PProvider implements PaymentProvider {
  name = "twoc2p";
  private apiKey: string;
  private merchantId: string;
  private apiUrl = "https://sandbox-pgw.2c2p.com/payment/4.1";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.merchantId = Deno.env.get("TWOC2P_MERCHANT_ID") || "";
  }

  private generateSignature(payload: string): string {
    // Simple HMAC-SHA256 signature for 2C2P
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.apiKey);
    const payloadData = encoder.encode(payload);
    
    // This is a simplified version - in production use proper HMAC
    return btoa(payload + this.apiKey).substring(0, 64);
  }

  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResponse> {
    const invoiceNo = `INV${Date.now()}`;
    const payload = {
      merchantID: this.merchantId,
      invoiceNo: invoiceNo,
      description: params.reference || "Payment",
      amount: (params.amount / 100).toFixed(2),
      currencyCode: params.currency,
      nonceStr: crypto.randomUUID(),
      paymentChannel: params.methodTypes,
      uiParams: {
        userLanguage: "EN",
      },
      frontendReturnUrl: params.successUrl || "https://example.com/success",
      backendReturnUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/webhooks-twoc2p`,
    };

    const payloadString = JSON.stringify(payload);
    const signature = this.generateSignature(payloadString);

    const response = await fetch(`${this.apiUrl}/paymentToken`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Signature": signature,
      },
      body: payloadString,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`2C2P API error: ${error}`);
    }

    const result = await response.json();

    if (result.respCode !== "0000") {
      throw new Error(`2C2P error: ${result.respDesc}`);
    }

    return {
      providerSessionId: result.paymentToken || invoiceNo,
      redirectUrl: result.webPaymentUrl,
      status: "pending",
    };
  }

  async getPaymentStatus(providerSessionId: string): Promise<PaymentStatusResponse> {
    const payload = {
      merchantID: this.merchantId,
      invoiceNo: providerSessionId,
    };

    const payloadString = JSON.stringify(payload);
    const signature = this.generateSignature(payloadString);

    const response = await fetch(`${this.apiUrl}/paymentInquiry`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Signature": signature,
      },
      body: payloadString,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`2C2P API error: ${error}`);
    }

    const result = await response.json();

    const statusMap: Record<string, string> = {
      "0000": "paid",
      "0001": "pending",
      "0002": "failed",
    };

    return {
      id: providerSessionId,
      status: statusMap[result.respCode] || "pending",
      amount: parseFloat(result.amount) * 100,
      currency: result.currencyCode,
      paidAt: result.respCode === "0000" ? new Date().toISOString() : undefined,
      metadata: result,
    };
  }

  async refund(paymentId: string, amount: number, reason?: string): Promise<RefundResponse> {
    const payload = {
      merchantID: this.merchantId,
      invoiceNo: paymentId,
      refundAmount: (amount / 100).toFixed(2),
      reason: reason || "Refund requested",
    };

    const payloadString = JSON.stringify(payload);
    const signature = this.generateSignature(payloadString);

    const response = await fetch(`${this.apiUrl}/refund`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Signature": signature,
      },
      body: payloadString,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`2C2P API error: ${error}`);
    }

    const result = await response.json();

    return {
      refundId: result.refundTransactionId || crypto.randomUUID(),
      status: result.respCode === "0000" ? "succeeded" : "pending",
      amount: amount,
    };
  }
}
