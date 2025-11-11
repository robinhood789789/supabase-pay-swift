import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

serve(async (req) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract slug from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const slug = pathParts[pathParts.length - 1];

    if (!slug) {
      return new Response(JSON.stringify({ error: 'Slug required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get payment link by slug
    const { data: link, error } = await supabase
      .from('payment_links')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error || !link) {
      return new Response(JSON.stringify({ error: 'Payment link not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if expired
    const now = new Date();
    const expiresAt = link.expires_at ? new Date(link.expires_at) : null;
    const isExpired = expiresAt && expiresAt < now;

    // Check usage limit
    const usageLimitReached = link.usage_limit && link.used_count >= link.usage_limit;

    // Return public-safe data
    const publicLink = {
      slug: link.slug,
      amount: link.amount,
      currency: link.currency,
      reference: link.reference,
      status: link.status,
      expires_at: link.expires_at,
      isExpired,
      usageLimitReached,
      canPay: link.status === 'active' && !isExpired && !usageLimitReached,
    };

    return new Response(JSON.stringify(publicLink), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
