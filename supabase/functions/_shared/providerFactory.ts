import type { PaymentProvider } from "./paymentProvider.ts";
import { StripeProvider } from "./providers/stripe.ts";
import { OpnProvider } from "./providers/opn.ts";
import { TwoC2PProvider } from "./providers/twoc2p.ts";
import { KBankProvider } from "./providers/kbank.ts";

export async function getPaymentProvider(
  supabase: any,
  tenantId: string
): Promise<PaymentProvider> {
  // First, check for environment variable (global override)
  const envProvider = Deno.env.get("PAYMENT_PROVIDER");
  
  // Then check tenant-specific settings
  const { data: settings } = await supabase
    .from("tenant_settings")
    .select("provider")
    .eq("tenant_id", tenantId)
    .single();

  const providerName = envProvider || settings?.provider || "stripe";

  switch (providerName.toLowerCase()) {
    case "stripe": {
      const apiKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!apiKey) {
        throw new Error("STRIPE_SECRET_KEY not configured");
      }
      return new StripeProvider(apiKey);
    }
    case "opn":
    case "omise": {
      const apiKey = Deno.env.get("OPN_SECRET_KEY");
      if (!apiKey) {
        throw new Error("OPN_SECRET_KEY not configured");
      }
      return new OpnProvider(apiKey);
    }
    case "twoc2p":
    case "2c2p": {
      const apiKey = Deno.env.get("TWOC2P_SECRET_KEY");
      if (!apiKey) {
        throw new Error("TWOC2P_SECRET_KEY not configured");
      }
      return new TwoC2PProvider(apiKey);
    }
    case "kbank": {
      const apiKey = Deno.env.get("KBANK_SECRET_KEY");
      if (!apiKey) {
        throw new Error("KBANK_SECRET_KEY not configured");
      }
      return new KBankProvider(apiKey);
    }
    default:
      throw new Error(`Unknown payment provider: ${providerName}`);
  }
}
