import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireCSRF } from '../_shared/csrf-validation.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { validateString, sanitizeErrorMessage } from '../_shared/validation.ts';
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

serve(async (req) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify the user making the request
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !requestingUser) {
      console.error('Auth error:', authError);
      throw new Error('Unauthorized');
    }

    console.log('🔐 Requesting user:', requestingUser.id);

    // CSRF validation
    const csrfError = await requireCSRF(req, requestingUser.id);
    if (csrfError) return csrfError;

    // Rate limiting: 10 user deletions per hour per user
    const rateLimitResult = checkRateLimit(requestingUser.id, 10, 3600000);
    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Too many user deletion requests. Please try again later.',
          resetAt: new Date(rateLimitResult.resetAt).toISOString()
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { user_id, tenant_id } = await req.json();

    // Input validation
    const validationErrors = [];
    
    const userIdError = validateString('user_id', user_id, { required: true, maxLength: 255 });
    if (userIdError) validationErrors.push(userIdError);
    
    const tenantIdError = validateString('tenant_id', tenant_id, { required: true, maxLength: 255 });
    if (tenantIdError) validationErrors.push(tenantIdError);

    if (validationErrors.length > 0) {
      return new Response(
        JSON.stringify({ error: validationErrors.map(e => e.message).join(', ') }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🗑️ Delete request:', { user_id, tenant_id });

    // Check if requesting user is owner or admin in the tenant
    const { data: requestingMembership, error: membershipError } = await supabase
      .from('memberships')
      .select('role_id, roles!inner(name)')
      .eq('user_id', requestingUser.id)
      .eq('tenant_id', tenant_id)
      .single();

    if (membershipError || !requestingMembership) {
      console.error('Membership error:', membershipError);
      throw new Error('Not a member of this tenant');
    }

    const requestingRole = (requestingMembership.roles as any)?.name;
    if (requestingRole !== 'owner') {
      throw new Error('Insufficient permissions. Only owners can delete users.');
    }

    console.log('✅ Requesting user role:', requestingRole);

    // Cannot delete yourself
    if (user_id === requestingUser.id) {
      throw new Error('Cannot delete your own account');
    }

    // Get the target user's role
    const { data: targetMembership, error: targetMembershipError } = await supabase
      .from('memberships')
      .select('role_id, roles!inner(name)')
      .eq('user_id', user_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (targetMembershipError) {
      console.error('Target membership error:', targetMembershipError);
      throw new Error('User not found in this tenant');
    }

    const targetRole = (targetMembership.roles as any)?.name;
    console.log('🎯 Target user role:', targetRole);

    // Only owner can delete owner
    if (targetRole === 'owner' && requestingRole !== 'owner') {
      throw new Error('Only owners can remove other owners');
    }

    // Delete the membership (this will remove the user from the tenant)
    const { error: deleteMembershipError } = await supabase
      .from('memberships')
      .delete()
      .eq('user_id', user_id)
      .eq('tenant_id', tenant_id);

    if (deleteMembershipError) {
      console.error('Delete membership error:', deleteMembershipError);
      throw deleteMembershipError;
    }

    console.log('✅ Successfully deleted membership');

    // Check if user has any other memberships
    const { data: otherMemberships, error: otherMembershipsError } = await supabase
      .from('memberships')
      .select('id')
      .eq('user_id', user_id);

    if (otherMembershipsError) {
      console.error('Check other memberships error:', otherMembershipsError);
    }

    // If user has no other memberships, optionally delete the auth user
    // For now, we'll just remove from tenant, not delete the auth account
    const hasOtherMemberships = otherMemberships && otherMemberships.length > 0;

    console.log('📊 User has other memberships:', hasOtherMemberships);

    // Log the action in audit log
    await supabase
      .from('audit_logs')
      .insert({
        tenant_id,
        actor_user_id: requestingUser.id,
        action: 'user.deleted',
        target: user_id,
        before: { role: targetRole },
        after: null,
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: hasOtherMemberships 
          ? 'User removed from workspace successfully'
          : 'User removed from workspace (only membership)',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ error: sanitizeErrorMessage(error) }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});