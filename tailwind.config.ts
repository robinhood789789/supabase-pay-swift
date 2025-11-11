import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          glow: "hsl(var(--primary-glow))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        nebula: {
          red: "hsl(var(--nebula-red))",
          orange: "hsl(var(--nebula-orange))",
          pink: "hsl(var(--nebula-pink))",
          "deep-red": "hsl(var(--nebula-deep-red))",
        },
        glass: {
          DEFAULT: "hsl(var(--glass-background))",
          border: "hsl(var(--glass-border))",
          hover: "hsl(var(--glass-hover-background))",
          "hover-border": "hsl(var(--glass-hover-border))",
        },
        "nebula-glass": {
          DEFAULT: "hsl(var(--nebula-red) / 0.1)",
          hover: "hsl(var(--nebula-red) / 0.2)",
        },
        "nebula-border": {
          DEFAULT: "hsl(var(--nebula-orange) / 0.3)",
          hover: "hsl(var(--nebula-orange) / 0.5)",
        },
      },
      backgroundImage: {
        "gradient-primary": "var(--gradient-primary)",
        "gradient-success": "var(--gradient-success)",
        "gradient-deposit": "var(--gradient-deposit)",
        "gradient-withdrawal": "var(--gradient-withdrawal)",
        "gradient-balance": "var(--gradient-balance)",
        "gradient-activity": "var(--gradient-activity)",
        "gradient-info": "var(--gradient-info)",
        "gradient-users": "var(--gradient-users)",
        "gradient-hero": "var(--gradient-hero)",
        "gradient-subtle": "var(--gradient-subtle)",
        "gradient-radial": "var(--gradient-radial)",
        "gradient-radial-bright": "var(--gradient-radial-bright)",
        "gradient-neon": "var(--gradient-neon)",
        "gradient-aurora": "var(--gradient-aurora)",
        "gradient-nebula": "var(--gradient-nebula)",
        "gradient-nebula-dust": "var(--gradient-nebula-dust)",
        "gradient-cosmic": "var(--gradient-cosmic)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        glow: "var(--shadow-glow)",
        elegant: "var(--shadow-elegant)",
        neon: "var(--shadow-neon)",
        glass: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
        "glow-cosmic": "0 0 30px hsl(189 100% 50% / 0.4), 0 0 60px hsl(280 100% 60% / 0.2)",
        "nebula-glow": "0 0 30px hsl(0 95% 55% / 0.4), 0 0 60px hsl(15 100% 60% / 0.2)",
      },
      transitionTimingFunction: {
        smooth: "var(--transition-smooth)",
      },
      backdropBlur: {
        xs: "2px",
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "24px",
        "3xl": "40px",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
