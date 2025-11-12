import * as React from "react";
import { cn } from "@/lib/utils";
import { Textarea, type TextareaProps } from "@/components/ui/textarea";

export interface FloatingTextareaProps extends Omit<TextareaProps, "placeholder"> {
  label: string;
  error?: string;
  success?: string;
}

const FloatingTextarea = React.forwardRef<HTMLTextAreaElement, FloatingTextareaProps>(
  ({ className, label, error, success, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const [hasValue, setHasValue] = React.useState(false);

    const handleFocus = () => setIsFocused(true);
    const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      setIsFocused(false);
      setHasValue(e.target.value !== "");
      props.onBlur?.(e);
    };

    return (
      <div className="relative w-full">
        <Textarea
          ref={ref}
          className={cn(
            "peer pt-6 pb-2 resize-none",
            error && "border-destructive",
            success && "border-success",
            className
          )}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
        <label
          className={cn(
            "absolute left-3 top-4 transition-all duration-300 pointer-events-none",
            "text-muted-foreground",
            isFocused || hasValue || props.value || props.defaultValue
              ? "top-2 text-xs"
              : "text-sm",
            isFocused && "text-foreground",
            error && "text-destructive",
            success && "text-success"
          )}
        >
          {label}
        </label>
        
        {error && (
          <p className="mt-1.5 text-xs text-destructive animate-fade-in">
            {error}
          </p>
        )}
        {success && (
          <p className="mt-1.5 text-xs text-success animate-fade-in">
            {success}
          </p>
        )}
      </div>
    );
  }
);
FloatingTextarea.displayName = "FloatingTextarea";

export { FloatingTextarea };
