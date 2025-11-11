import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ShieldAlert } from "lucide-react";

interface PasswordBreachAlertProps {
  variant?: "default" | "destructive";
  title?: string;
  showDetails?: boolean;
}

export function PasswordBreachAlert({ 
  variant = "destructive",
  title,
  showDetails = true 
}: PasswordBreachAlertProps) {
  const getIcon = () => {
    return variant === "destructive" 
      ? <ShieldAlert className="h-4 w-4" />
      : <AlertTriangle className="h-4 w-4" />;
  };

  const getDefaultTitle = () => {
    return variant === "destructive"
      ? "Password Found in Data Breach"
      : "Password Security Warning";
  };

  return (
    <Alert variant={variant} className="mb-4">
      {getIcon()}
      <AlertTitle>{title || getDefaultTitle()}</AlertTitle>
      <AlertDescription className="mt-2 space-y-2">
        <p className="text-sm">
          This password has been exposed in a known data breach and cannot be used for your security.
        </p>
        {showDetails && (
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Please choose a different password that:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Has not been used on other websites</li>
              <li>Is at least 8 characters long</li>
              <li>Contains a mix of letters, numbers, and symbols</li>
              <li>Is unique and not found in data breaches</li>
            </ul>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          We check passwords against the{" "}
          <a 
            href="https://haveibeenpwned.com/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            HaveIBeenPwned
          </a>
          {" "}database to protect your account.
        </p>
      </AlertDescription>
    </Alert>
  );
}

// Helper function to detect if error is a password breach error
export function isPasswordBreachError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = error.message?.toLowerCase() || "";
  const errorCode = error.code?.toLowerCase() || "";
  
  // Common breach detection patterns from Supabase Auth
  return (
    errorMessage.includes("breach") ||
    errorMessage.includes("compromised") ||
    errorMessage.includes("pwned") ||
    errorMessage.includes("exposed") ||
    errorCode.includes("password_breach") ||
    errorCode.includes("weak_password")
  );
}
