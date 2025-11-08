import { useEffect } from 'react';
import { useAuth } from "@/hooks/useAuth";
import { setCSRFToken, clearCSRFToken } from '@/lib/security/csrf';

export function useCSRF() {
  const { user } = useAuth();

  useEffect(() => {
    if (user?.id) {
      // Set CSRF token when user logs in
      setCSRFToken(user.id).catch(console.error);
    } else {
      // Clear CSRF token when user logs out
      clearCSRFToken();
    }
  }, [user?.id]);
}
