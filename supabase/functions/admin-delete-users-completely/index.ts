import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

serve(async (req) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify the user making the request is super admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !requestingUser) {
      console.error('Auth error:', authError);
      throw new Error('Unauthorized');
    }

    const { user_ids, tenant_id } = await req.json();

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      throw new Error('Missing or invalid user_ids array');
    }

    if (!tenant_id) {
      throw new Error('Missing tenant_id');
    }

    console.log('🗑️ Deleting users:', user_ids, 'from tenant:', tenant_id);

    // Check if requesting user is super admin OR owner/admin of the tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', requestingUser.id)
      .single();

    const isSuperAdmin = profile?.is_super_admin || false;

    if (!isSuperAdmin) {
      // Check if user is owner in the tenant
      const { data: membership, error: membershipError } = await supabase
        .from('memberships')
        .select('role_id, roles!inner(name)')
        .eq('user_id', requestingUser.id)
        .eq('tenant_id', tenant_id)
        .single();

      if (membershipError || !membership) {
        throw new Error('You do not have permission to delete users in this tenant');
      }

      const role = (membership.roles as any)?.name;
      if (role !== 'owner') {
        throw new Error('Only owners can delete users');
      }

      console.log('✅ Owner verified:', requestingUser.id);
    } else {
      console.log('✅ Super admin verified:', requestingUser.id);
    }

    const results = [];

    for (const userId of user_ids) {
      try {
        // Cannot delete yourself
        if (userId === requestingUser.id) {
          results.push({
            user_id: userId,
            success: false,
            error: 'Cannot delete your own account'
          });
          continue;
        }

        // For non-super-admins, only delete membership in current tenant
        if (!isSuperAdmin) {
          const { error: membershipError } = await supabase
            .from('memberships')
            .delete()
            .eq('user_id', userId)
            .eq('tenant_id', tenant_id);

          if (membershipError) {
            console.error('Delete membership error:', membershipError);
            throw membershipError;
          }

          // Check if user has other memberships
          const { data: otherMemberships } = await supabase
            .from('memberships')
            .select('id')
            .eq('user_id', userId);

          if (otherMemberships && otherMemberships.length > 0) {
            console.log('✅ User removed from tenant (has other memberships)');
            results.push({
              user_id: userId,
              success: true,
              message: 'User removed from tenant'
            });
            continue;
          }
        } else {
          // Super admin can delete all memberships
          const { error: membershipError } = await supabase
            .from('memberships')
            .delete()
            .eq('user_id', userId);

          if (membershipError) {
            console.error('Delete all memberships error:', membershipError);
            throw membershipError;
          }
        }

        // Delete profile
        const { error: profileError } = await supabase
          .from('profiles')
          .delete()
          .eq('id', userId);

        if (profileError) {
          console.error('Delete profile error:', profileError);
        }

        // Delete auth user using admin API
        const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);

        if (deleteAuthError) {
          console.error('Delete auth user error:', deleteAuthError);
          throw deleteAuthError;
        }

        console.log('✅ Successfully deleted user:', userId);

        results.push({
          user_id: userId,
          success: true
        });

      } catch (error: any) {
        console.error('❌ Error deleting user:', userId, error);
        results.push({
          user_id: userId,
          success: false,
          error: error?.message || 'Unknown error'
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
