import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const textareaVariants = cva(
  "flex min-h-[80px] w-full rounded-md px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300",
  {
    variants: {
      variant: {
        default: "border border-input bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        glass: "backdrop-blur-xl bg-glass border border-glass-border hover:bg-glass-hover hover:border-glass-hover-border focus-visible:border-primary focus-visible:shadow-glow-cosmic focus-visible:ring-0",
        "glass-nebula": "backdrop-blur-xl bg-nebula-glass border border-nebula-border hover:bg-nebula-glass-hover hover:border-nebula-border-hover focus-visible:border-nebula-orange focus-visible:shadow-nebula-glow focus-visible:ring-0",
      },
      validationState: {
        none: "",
        error: "border-destructive focus-visible:border-destructive focus-visible:shadow-[0_0_20px_hsl(0_84.2%_60.2%/0.4)]",
        success: "border-success focus-visible:border-success focus-visible:shadow-[0_0_20px_hsl(167_70%_50%/0.4)]",
      },
    },
    defaultVariants: {
      variant: "default",
      validationState: "none",
    },
  }
);

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant, validationState, ...props }, ref) => {
    return (
      <textarea
        className={cn(textareaVariants({ variant, validationState }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea, textareaVariants };
