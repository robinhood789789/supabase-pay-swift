import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { generateBackupCodes, hashCode } from "../_shared/totp.ts";
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

serve(async (req) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    console.log(`[MFA Recovery Regen] User ${user.email} regenerating recovery codes`);

    // Check if user has 2FA enabled
    const { data: profile } = await supabase
      .from('profiles')
      .select('totp_enabled')
      .eq('id', user.id)
      .single();

    if (!profile?.totp_enabled) {
      throw new Error('Two-factor authentication is not enabled');
    }

    // Generate new recovery codes
    const recoveryCodes = generateBackupCodes(10);
    // Hash the codes WITHOUT hyphens for storage
    const hashedCodes = await Promise.all(
      recoveryCodes.map(code => hashCode(code.replace(/-/g, '')))
    );

    console.log(`[MFA Recovery Regen] Generated ${recoveryCodes.length} new recovery codes (hashed)`);

    // Update recovery codes in database (invalidates old ones)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ totp_backup_codes: hashedCodes })
      .eq('id', user.id);

    if (updateError) {
      console.error('[MFA Recovery Regen] Error updating codes:', updateError);
      throw updateError;
    }

    // Create audit log
    await supabase
      .from('audit_logs')
      .insert({
        actor_user_id: user.id,
        action: 'mfa.recovery_codes.regenerated',
        target: `user:${user.id}`,
        tenant_id: null,
      });

    return new Response(
      JSON.stringify({ 
        success: true,
        recovery_codes: recoveryCodes,
        message: 'Recovery codes regenerated successfully. Previous codes are now invalid.'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('[MFA Recovery Regen] Error:', error);
    const message = error instanceof Error ? error.message : 'An error occurred';
    return new Response(
      JSON.stringify({ error: message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
