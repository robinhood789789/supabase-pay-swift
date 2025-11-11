import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

serve(async (req) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminEmail = Deno.env.get('ADMIN_EMAIL');

    // Check if ADMIN_EMAIL is configured
    if (!adminEmail) {
      console.error('ADMIN_EMAIL environment variable is not set');
      return new Response(
        JSON.stringify({ error: 'ADMIN_EMAIL not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Bootstrap: Looking for admin user with email: ${adminEmail}`);

    // Find user by email in auth.users
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return new Response(
        JSON.stringify({ error: 'Failed to list users', details: listError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminUser = users.find(u => u.email === adminEmail);

    if (!adminUser) {
      console.error(`Admin user with email ${adminEmail} not found`);
      return new Response(
        JSON.stringify({ error: `User with email ${adminEmail} not found. Please ensure the user has signed up first.` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found admin user: ${adminUser.id}`);

    // Find or create super_admin role
    let { data: superAdminRole, error: roleError } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'super_admin')
      .is('tenant_id', null)
      .eq('is_system', true)
      .maybeSingle();

    if (roleError) {
      console.error('Error finding super_admin role:', roleError);
      return new Response(
        JSON.stringify({ error: 'Failed to find super_admin role', details: roleError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If super_admin role doesn't exist, create it
    if (!superAdminRole) {
      console.log('Creating super_admin role');
      const { data: newRole, error: createRoleError } = await supabase
        .from('roles')
        .insert({
          name: 'super_admin',
          description: 'Platform administrator with full system access',
          is_system: true,
          tenant_id: null
        })
        .select('id')
        .single();

      if (createRoleError) {
        console.error('Error creating super_admin role:', createRoleError);
        return new Response(
          JSON.stringify({ error: 'Failed to create super_admin role', details: createRoleError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      superAdminRole = newRole;
      console.log(`Created super_admin role with id: ${superAdminRole.id}`);
    }

    // Check if user already has super_admin role
    const { data: existingMembership, error: checkError } = await supabase
      .from('memberships')
      .select('id')
      .eq('user_id', adminUser.id)
      .eq('role_id', superAdminRole.id)
      .is('tenant_id', null)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing membership:', checkError);
      return new Response(
        JSON.stringify({ error: 'Failed to check existing membership', details: checkError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existingMembership) {
      console.log('User already has super_admin role');
      return new Response(
        JSON.stringify({ 
          message: 'User already has super_admin role',
          userId: adminUser.id,
          roleId: superAdminRole.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Assign super_admin role to user
    console.log(`Assigning super_admin role to user ${adminUser.id}`);
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .insert({
        user_id: adminUser.id,
        role_id: superAdminRole.id,
        tenant_id: null
      })
      .select()
      .single();

    if (membershipError) {
      console.error('Error creating membership:', membershipError);
      return new Response(
        JSON.stringify({ error: 'Failed to assign super_admin role', details: membershipError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully assigned super_admin role');
    return new Response(
      JSON.stringify({ 
        message: 'Successfully assigned super_admin role',
        userId: adminUser.id,
        roleId: superAdminRole.id,
        membershipId: membership.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
