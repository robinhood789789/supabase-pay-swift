import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (publicIdOrEmail: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string, referralCode?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  isSuperAdmin: boolean;
  userRole: string | null;
  tenantId: string | null;
  tenantName: string | null;
  publicId: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [publicId, setPublicId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer Supabase calls with setTimeout to avoid auth deadlock
        if (session?.user) {
          setTimeout(() => {
            if (mounted) fetchUserRole(session.user.id);
          }, 0);
        } else {
          setIsSuperAdmin(false);
          setUserRole(null);
          setTenantId(null);
          setTenantName(null);
          setPublicId(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await fetchUserRole(session.user.id);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      // Check if user is super admin first
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("is_super_admin, email, full_name, public_id")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) throw profileError;

      const isSuperAdminUser = profileData?.is_super_admin || false;
      setIsSuperAdmin(isSuperAdminUser);
      setPublicId(profileData?.public_id || null);

      // Get active tenant from localStorage (user-scoped if present)
      const getKey = (uid?: string) => (uid ? `active_tenant_id:${uid}` : "active_tenant_id");
      const activeTenantId = localStorage.getItem(getKey(userId)) || localStorage.getItem("active_tenant_id");

      // Fetch user membership info - get ALL memberships first
      const { data: allMemberships, error: membershipError } = await supabase
        .from("memberships")
        .select("tenant_id, role_id")
        .eq("user_id", userId);

      if (membershipError && !isSuperAdminUser) {
        if (!isSuperAdminUser) throw membershipError;
      }

      // Select membership for active tenant, or first one if no active tenant
      let membershipData = null;
      if (allMemberships && allMemberships.length > 0) {
        if (activeTenantId) {
          membershipData = allMemberships.find(m => m.tenant_id === activeTenantId);
        }
        // Fallback to first membership if no active tenant or not found
        if (!membershipData) {
          membershipData = allMemberships[0];
        }
      }

      if (membershipData) {
        // Fetch role name separately
        const { data: roleData } = await supabase
          .from("roles")
          .select("name")
          .eq("id", membershipData.role_id)
          .maybeSingle();

        // Fetch tenant name separately
        const { data: tenantData } = await supabase
          .from("tenants")
          .select("name")
          .eq("id", membershipData.tenant_id)
          .maybeSingle();

        const roleName = roleData?.name || null;
        setUserRole(roleName);
        setTenantId(membershipData.tenant_id);
        setTenantName(tenantData?.name || null);
      } else if (isSuperAdminUser) {
        // Super admin doesn't need membership
        setUserRole("super_admin");
      }
    } catch (error) {
      console.error("Error fetching user role:", error);
    }
  };

  const signIn = async (publicIdOrEmail: string, password: string) => {
    try {
      let email = publicIdOrEmail;
      
      // Check if it's a Public ID format (PREFIX-NNNNNN)
      if (/^[A-Z0-9]{2,6}-\d{6}$/.test(publicIdOrEmail)) {
        console.log('Looking up email for public_id:', publicIdOrEmail);
        
        // Use database function to lookup email (bypasses RLS)
        const { data: emailData, error: lookupError } = await supabase
          .rpc('get_email_by_public_id', { input_public_id: publicIdOrEmail });
        
        if (lookupError) {
          console.error('Error looking up public_id:', lookupError);
          // Fallback: try using {user_id}@system.local format for bootstrap test accounts
          email = `${publicIdOrEmail}@system.local`;
          console.log('Fallback to system email format:', email);
        } else if (!emailData) {
          console.log('Public ID not found in database, using fallback email');
          // Fallback: try using {user_id}@system.local format for bootstrap test accounts
          email = `${publicIdOrEmail}@system.local`;
        } else {
          console.log('Found email for public_id:', emailData);
          email = emailData as string;
        }
      }

      console.log('Attempting sign in with email:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Sign in error:', error);
        toast({
          title: "เข้าสู่ระบบไม่สำเร็จ",
          description: error.message === 'Invalid login credentials' 
            ? "รหัสผ่านไม่ถูกต้อง" 
            : error.message,
          variant: "destructive",
        });
        return { error };
      }

      console.log('Sign in successful');
      toast({
        title: "เข้าสู่ระบบสำเร็จ",
        description: "กำลังโหลดข้อมูล...",
      });

      if (error) throw error;

      // Fetch user profile and role info
      const { data: profile } = await supabase
        .from("profiles")
        .select("totp_enabled, id, is_super_admin")
        .eq("id", data.user?.id)
        .single();

      // Fetch membership to get role and tenant - get ALL memberships
      const { data: allMemberships } = await supabase
        .from("memberships")
        .select("role_id, tenant_id")
        .eq("user_id", data.user?.id);

      // Get active tenant or use first membership (user-scoped if present)
      const getKey = (uid?: string) => (uid ? `active_tenant_id:${uid}` : "active_tenant_id");
      const activeTenantId = localStorage.getItem(getKey(data.user?.id)) || localStorage.getItem("active_tenant_id");
      let membership = null;
      
      if (allMemberships && allMemberships.length > 0) {
        if (activeTenantId) {
          membership = allMemberships.find(m => m.tenant_id === activeTenantId);
        }
        if (!membership) {
          membership = allMemberships[0];
        }
      }

      // Get role name if membership exists
      let role = null;
      if (membership?.role_id) {
        const { data: roleData } = await supabase
          .from("roles")
          .select("name")
          .eq("id", membership.role_id)
          .maybeSingle();
        role = roleData?.name;
      }

      const tenantId = membership?.tenant_id;
      const isSuperAdmin = profile?.is_super_admin || false;

      // Determine destination: shareholder users go directly to their dashboard
      let destination = "/dashboard";
      try {
        const { data: sh } = await supabase
          .from("shareholders")
          .select("status")
          .eq("user_id", data.user?.id)
          .eq("status", "active")
          .maybeSingle();
        if (sh) destination = "/shareholder/dashboard";
      } catch {}

      // Check if MFA is required
      let mfaRequired = false;

      if (isSuperAdmin) {
        // Super admin always requires MFA
        mfaRequired = true;
      } else if (tenantId && (role === 'owner' || role === 'finance')) {
        // Check tenant security policy
        const { data: policy } = await supabase
          .from("tenant_security_policy")
          .select("require_2fa_for_owner, require_2fa_for_finance")
          .eq("tenant_id", tenantId)
          .single();

        if (policy) {
          if (role === 'owner' && policy.require_2fa_for_owner) {
            mfaRequired = true;
          } else if (role === 'finance' && policy.require_2fa_for_finance) {
            mfaRequired = true;
          }
        }
      }

      // Handle MFA flow
      if (mfaRequired) {
        if (!profile?.totp_enabled) {
          // MFA required but not enrolled, redirect to settings
          toast({
            title: "Two-Factor Authentication Required",
            description: "Two-Factor Authentication is required for your role. Please enable it.",
          });
          navigate("/settings", { state: { tab: 'security' } });
          return { error: null };
        }

        // MFA enabled, redirect to challenge
        toast({
          title: "ยืนยันตัวตน",
          description: "กรุณายืนยันตัวตนด้วย 2FA",
        });
        navigate("/auth/mfa-challenge", { 
          state: { 
            returnTo: destination 
          } 
        });
        return { error: null };
      }

      // Check if user has 2FA enabled (optional MFA)
      if (profile?.totp_enabled) {
        toast({
          title: "ยืนยันตัวตน",
          description: "กรุณายืนยันตัวตนด้วย 2FA",
        });
        navigate("/auth/mfa-challenge", { 
          state: { 
            returnTo: destination 
          } 
        });
      } else {
        // No MFA, proceed to dashboard
        toast({
          title: "เข้าสู่ระบบสำเร็จ",
          description: "กำลังโหลดข้อมูล...",
        });
        navigate(destination);
      }
      
      return { error: null };
    } catch (error: any) {
      toast({
        title: "เข้าสู่ระบบไม่สำเร็จ",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, referralCode?: string) => {
    const redirectUrl = `${window.location.origin}/dashboard`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          referral_code: referralCode || null,
        },
      },
    });

    if (error) {
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Sign up successful!",
        description: "Logging you in...",
      });
      navigate("/dashboard");
    }

    return { error };
  };

  const signOut = async () => {
    // โหมดเด็ดขาด: เคลียร์ token ทั้งหมดและเด้งไปหน้า sign-in ทันที
    setSigningOut(true);

    try {
      // เคลียร์ token ของ Supabase ทั้งหมดใน localStorage
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key) continue;
          if (key.startsWith("sb-") || key === "active_tenant_id" || (user?.id && key === `active_tenant_id:${user.id}`)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch {}

      // เคลียร์สถานะในเมมโมรีทันที
      setUser(null);
      setSession(null);
      setIsSuperAdmin(false);
      setUserRole(null);
      setTenantId(null);
      setTenantName(null);
      setPublicId(null);
    } finally {
      // เด้งไปหน้า sign-in ทันทีแบบ force reload
      window.location.replace("/auth/sign-in");

      // พยายาม sign out ฝั่ง backend แบบ async (ไม่บล็อค UI)
      setTimeout(() => {
        supabase.auth.signOut().catch(() => {});
      }, 0);
    }
  };

  // Show nothing while signing out to prevent any component from trying to use auth context
  if (signingOut) {
    return null;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        isSuperAdmin,
        userRole,
        tenantId,
        tenantName,
        publicId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
