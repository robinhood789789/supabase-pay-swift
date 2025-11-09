import { CheckCircle, AlertCircle } from "lucide-react";
import { PasswordStrength } from "@/hooks/usePasswordStrength";

interface PasswordStrengthMeterProps {
  strength: PasswordStrength;
  password: string;
  confirmPassword?: string;
  showRequirements?: boolean;
}

export function PasswordStrengthMeter({
  strength,
  password,
  confirmPassword,
  showRequirements = true,
}: PasswordStrengthMeterProps) {
  if (!password) return null;

  const { score, label, color, checks } = strength;

  return (
    <div className="space-y-3">
      {/* Strength Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">ความแข็งแกร่ง:</span>
          <span className={`font-medium ${color}`}>{label}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              score < 30
                ? "bg-red-500"
                : score < 50
                ? "bg-orange-500"
                : score < 70
                ? "bg-yellow-500"
                : score < 85
                ? "bg-green-500"
                : "bg-emerald-500"
            }`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      {/* Requirements Checklist */}
      {showRequirements && (
        <div className="space-y-1 text-sm">
          <p className="font-medium text-muted-foreground">เงื่อนไขรหัสผ่าน:</p>
          <div className="space-y-1">
            <div
              className={`flex items-center gap-2 ${
                checks.length ? "text-green-600" : "text-muted-foreground"
              }`}
            >
              {checks.length ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2" />
              )}
              <span>อย่างน้อย 12 ตัวอักษร</span>
            </div>
            <div
              className={`flex items-center gap-2 ${
                checks.uppercase ? "text-green-600" : "text-muted-foreground"
              }`}
            >
              {checks.uppercase ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2" />
              )}
              <span>มีตัวพิมพ์ใหญ่ (A-Z)</span>
            </div>
            <div
              className={`flex items-center gap-2 ${
                checks.lowercase ? "text-green-600" : "text-muted-foreground"
              }`}
            >
              {checks.lowercase ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2" />
              )}
              <span>มีตัวพิมพ์เล็ก (a-z)</span>
            </div>
            <div
              className={`flex items-center gap-2 ${
                checks.number ? "text-green-600" : "text-muted-foreground"
              }`}
            >
              {checks.number ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2" />
              )}
              <span>มีตัวเลข (0-9)</span>
            </div>
            <div
              className={`flex items-center gap-2 ${
                checks.special ? "text-green-600" : "text-muted-foreground"
              }`}
            >
              {checks.special ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2" />
              )}
              <span>มีอักขระพิเศษ (!@#$%^&*)</span>
            </div>
            {confirmPassword !== undefined && (
              <div
                className={`flex items-center gap-2 ${
                  checks.match ? "text-green-600" : "text-red-600"
                }`}
              >
                {checks.match ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <span>รหัสผ่านตรงกัน</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
