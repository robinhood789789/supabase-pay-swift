import * as React from "react";
import { cn } from "@/lib/utils";
import { Input, type InputProps } from "@/components/ui/input";

export interface FloatingInputProps extends Omit<InputProps, "placeholder"> {
  label: string;
  error?: string;
  success?: string;
}

const FloatingInput = React.forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ className, label, error, success, variant = "glass", ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const [hasValue, setHasValue] = React.useState(false);

    const handleFocus = () => setIsFocused(true);
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      setHasValue(e.target.value !== "");
      props.onBlur?.(e);
    };

    const validationState = error ? "error" : success ? "success" : "none";

    return (
      <div className="relative w-full">
        <Input
          ref={ref}
          className={cn(
            "peer pt-6 pb-2",
            className
          )}
          variant={variant}
          validationState={validationState}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
        <label
          className={cn(
            "absolute left-3 transition-all duration-300 pointer-events-none",
            "text-muted-foreground",
            isFocused || hasValue || props.value || props.defaultValue
              ? "top-2 text-xs"
              : "top-1/2 -translate-y-1/2 text-sm",
            isFocused && variant === "glass" && "text-primary",
            isFocused && variant === "glass-nebula" && "text-nebula-orange",
            error && "text-destructive",
            success && "text-success"
          )}
        >
          {label}
        </label>
        
        {/* Validation messages with cosmic glow */}
        {error && (
          <p className="mt-1.5 text-xs text-destructive flex items-center gap-1.5 animate-fade-in">
            <span className="inline-block w-1 h-1 rounded-full bg-destructive shadow-[0_0_8px_currentColor]" />
            {error}
          </p>
        )}
        {success && (
          <p className="mt-1.5 text-xs text-success flex items-center gap-1.5 animate-fade-in">
            <span className="inline-block w-1 h-1 rounded-full bg-success shadow-[0_0_8px_currentColor]" />
            {success}
          </p>
        )}
      </div>
    );
  }
);
FloatingInput.displayName = "FloatingInput";

export { FloatingInput };
