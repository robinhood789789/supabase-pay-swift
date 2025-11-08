import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getPaymentProvider } from "../_shared/providerFactory.ts";

// Public endpoint - no MFA required, but rate limiting recommended
// Recommended: 3 requests per minute per IP

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract slug from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const slug = pathParts[pathParts.length - 2]; // /payment-links/:slug/checkout

    if (!slug) {
      return new Response(JSON.stringify({ error: 'Slug required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get payment link
    const { data: link, error: linkError } = await supabase
      .from('payment_links')
      .select('*')
      .eq('slug', slug)
      .single();

    if (linkError || !link) {
      return new Response(JSON.stringify({ error: 'Payment link not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate link status
    const now = new Date();
    const expiresAt = link.expires_at ? new Date(link.expires_at) : null;
    const isExpired = expiresAt && expiresAt < now;

    if (link.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Payment link is inactive' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (isExpired) {
      return new Response(JSON.stringify({ error: 'Payment link has expired' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (link.usage_limit && link.used_count >= link.usage_limit) {
      return new Response(JSON.stringify({ error: 'Usage limit reached' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const body = await req.json();
    const { methodTypes } = body;

    if (!methodTypes || !Array.isArray(methodTypes)) {
      return new Response(JSON.stringify({ error: 'methodTypes array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get payment provider
    const provider = await getPaymentProvider(supabase, link.tenant_id);

    // Create checkout session
    const successUrl = `${url.origin}/pay/${slug}/success`;
    const cancelUrl = `${url.origin}/pay/${slug}`;

    const session = await provider.createCheckoutSession({
      amount: link.amount,
      currency: link.currency,
      reference: link.reference || `link_${slug}`,
      successUrl,
      cancelUrl,
      methodTypes,
      tenantId: link.tenant_id,
    });

    // Store checkout session
    const { data: checkoutSession, error: sessionError } = await supabase
      .from('checkout_sessions')
      .insert({
        tenant_id: link.tenant_id,
        provider: provider.name,
        provider_session_id: session.providerSessionId,
        amount: link.amount,
        currency: link.currency,
        reference: link.reference || `link_${slug}`,
        method_types: methodTypes,
        redirect_url: session.redirectUrl,
        qr_image_url: session.qrImageUrl,
        expires_at: session.expiresAt,
        status: 'pending',
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Error creating checkout session:', sessionError);
      return new Response(JSON.stringify({ error: 'Failed to create checkout session' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Increment used_count
    await supabase
      .from('payment_links')
      .update({ used_count: link.used_count + 1 })
      .eq('id', link.id);

    // Secure logging - no PII
    console.log(`[PayLink] Checkout created for link: ${slug}, amount: ${link.amount} ${link.currency}`);

    return new Response(JSON.stringify({
      sessionId: checkoutSession.id,
      redirectUrl: session.redirectUrl,
      qrImageUrl: session.qrImageUrl,
      expiresAt: session.expiresAt,
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    // Secure error logging - no sensitive data
    console.error('[PayLink] Error:', (error as Error).message);
    return new Response(JSON.stringify({ error: 'Failed to create checkout session' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
