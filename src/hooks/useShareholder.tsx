import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useShareholder = () => {
  const { user } = useAuth();

  const { data: shareholderData, isLoading } = useQuery({
    queryKey: ["shareholder", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Fetch shareholder data
      const { data: shareholderData, error: shareholderError } = await supabase
        .from("shareholders")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (shareholderError) throw shareholderError;
      if (!shareholderData) return null;

      // Fetch profile to get public_id
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("public_id")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      return {
        ...shareholderData,
        public_id: profileData?.public_id,
      };
    },
    enabled: !!user?.id,
  });

  const isShareholder = !!shareholderData && shareholderData.status === "active";

  return {
    shareholder: shareholderData,
    isShareholder,
    isLoading,
  };
};
