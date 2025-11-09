import { useMemo } from "react";

export interface PasswordChecks {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  special: boolean;
  match?: boolean;
}

export interface PasswordStrength {
  score: number;
  label: string;
  color: string;
  checks: PasswordChecks;
}

export function usePasswordStrength(
  password: string,
  confirmPassword?: string
): PasswordStrength {
  return useMemo(() => {
    // Check individual requirements
    const checks: PasswordChecks = {
      length: password.length >= 12,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*]/.test(password),
    };

    if (confirmPassword !== undefined) {
      checks.match = password.length > 0 && password === confirmPassword;
    }

    // Calculate password strength score
    if (password.length === 0) {
      return { score: 0, label: "", color: "", checks };
    }

    let score = 0;

    // Length scoring (0-40 points)
    if (password.length >= 12) score += 20;
    if (password.length >= 16) score += 10;
    if (password.length >= 20) score += 10;

    // Complexity scoring (60 points)
    if (checks.uppercase) score += 15;
    if (checks.lowercase) score += 15;
    if (checks.number) score += 15;
    if (checks.special) score += 15;

    // Variety bonus (check for multiple different characters)
    const uniqueChars = new Set(password).size;
    if (uniqueChars >= 8) score += 5;
    if (uniqueChars >= 12) score += 5;

    // Sequential or repeated character penalty
    const hasSequential = /(.)\1{2,}/.test(password); // 3+ repeated chars
    if (hasSequential) score -= 10;

    // Determine strength level
    let label = "";
    let color = "";

    if (score < 30) {
      label = "อ่อนมาก";
      color = "text-red-600";
    } else if (score < 50) {
      label = "อ่อน";
      color = "text-orange-600";
    } else if (score < 70) {
      label = "ปานกลาง";
      color = "text-yellow-600";
    } else if (score < 85) {
      label = "แข็งแกร่ง";
      color = "text-green-600";
    } else {
      label = "แข็งแกร่งมาก";
      color = "text-emerald-600";
    }

    const finalScore = Math.min(100, Math.max(0, score));

    return { score: finalScore, label, color, checks };
  }, [password, confirmPassword]);
}
