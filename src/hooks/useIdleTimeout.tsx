import { useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { useNavigate } from 'react-router-dom';

interface UseIdleTimeoutOptions {
  timeoutMinutes?: number; // Total idle time before logout
  warningMinutes?: number; // Warning time before logout
  enabled?: boolean;
}

export function useIdleTimeout({
  timeoutMinutes = 30,
  warningMinutes = 2,
  enabled = true,
}: UseIdleTimeoutOptions = {}) {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  
  const timeoutRef = useRef<NodeJS.Timeout>();
  const warningTimeoutRef = useRef<NodeJS.Timeout>();
  const countdownIntervalRef = useRef<NodeJS.Timeout>();

  const totalTimeout = timeoutMinutes * 60 * 1000;
  const warningTimeout = (timeoutMinutes - warningMinutes) * 60 * 1000;

  const clearAllTimers = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  };

  const handleLogout = async () => {
    clearAllTimers();
    setShowWarning(false);
    await signOut();
    navigate('/auth/sign-in');
  };

  const startCountdown = () => {
    setRemainingSeconds(warningMinutes * 60);
    
    countdownIntervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          handleLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const resetTimer = () => {
    if (!enabled || !user) return;

    clearAllTimers();
    setShowWarning(false);

    // Set warning timer
    warningTimeoutRef.current = setTimeout(() => {
      setShowWarning(true);
      startCountdown();
    }, warningTimeout);

    // Set logout timer
    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, totalTimeout);
  };

  const handleStayActive = () => {
    setShowWarning(false);
    resetTimer();
  };

  useEffect(() => {
    if (!enabled || !user) return;

    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    // Initial timer
    resetTimer();

    // Add event listeners
    events.forEach((event) => {
      document.addEventListener(event, resetTimer, { passive: true });
    });

    return () => {
      clearAllTimers();
      events.forEach((event) => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [enabled, user, timeoutMinutes, warningMinutes]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    showWarning,
    remainingSeconds,
    remainingTime: formatTime(remainingSeconds),
    handleStayActive,
    handleLogout,
  };
}
