import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function use2FAChallenge() {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const checkAndChallenge = async (action: () => void): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data: profile } = await supabase
        .from('profiles')
        .select('totp_enabled, is_super_admin')
        .eq('id', user.id)
        .single();

      // Super Admin must have MFA enabled
      if (profile?.is_super_admin && !profile?.totp_enabled) {
        const errorMsg = 'Super Admin ต้องเปิดใช้งาน MFA ก่อน กรุณาไปที่ Settings > Security เพื่อตั้งค่า';
        toast.error(errorMsg);
        return false;
      }

      // Non-super admin without MFA can proceed
      if (!profile?.totp_enabled) {
        action();
        return true;
      }

      // MFA enabled users need to verify via challenge
      // (stepup window tracking removed - always challenge if MFA enabled)

      // Need Step-Up MFA challenge
      setPendingAction(() => () => action());
      setIsOpen(true);
      return false;
    } catch (error) {
      console.error('2FA check failed:', error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('เกิดข้อผิดพลาดในการตรวจสอบ 2FA');
      }
      return false;
    }
  };

  const onSuccess = () => {
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  return {
    isOpen,
    setIsOpen,
    checkAndChallenge,
    onSuccess,
  };
}
