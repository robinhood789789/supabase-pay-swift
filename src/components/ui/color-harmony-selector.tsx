import { useState, useEffect } from "react";
import { Palette, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ColorHarmony = "default" | "complementary" | "triadic" | "analogous";

interface ColorPreset {
  name: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

const COLOR_HARMONIES: Record<ColorHarmony, ColorPreset> = {
  default: {
    name: "Default Cosmic",
    description: "Original futuristic palette",
    colors: {
      primary: "189 100% 50%",
      secondary: "45 85% 55%",
      accent: "326 50% 45%",
    },
  },
  complementary: {
    name: "Complementary",
    description: "Opposite colors for high contrast",
    colors: {
      primary: "189 100% 50%", // Cyan
      secondary: "9 100% 60%", // Orange-Red (opposite of cyan)
      accent: "280 65% 55%", // Purple (third color)
    },
  },
  triadic: {
    name: "Triadic",
    description: "Three colors equally spaced",
    colors: {
      primary: "189 100% 50%", // Cyan
      secondary: "309 85% 55%", // Magenta (+120 degrees)
      accent: "69 85% 55%", // Yellow-Green (+240 degrees)
    },
  },
  analogous: {
    name: "Analogous",
    description: "Adjacent colors for harmony",
    colors: {
      primary: "189 100% 50%", // Cyan
      secondary: "159 85% 55%", // Teal (-30 degrees)
      accent: "219 85% 55%", // Blue (+30 degrees)
    },
  },
};

export function ColorHarmonySelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedHarmony, setSelectedHarmony] = useState<ColorHarmony>("default");

  useEffect(() => {
    // Load saved harmony from localStorage
    const saved = localStorage.getItem("colorHarmony") as ColorHarmony;
    if (saved && COLOR_HARMONIES[saved]) {
      setSelectedHarmony(saved);
      applyColorHarmony(saved);
    }
  }, []);

  const applyColorHarmony = (harmony: ColorHarmony) => {
    const preset = COLOR_HARMONIES[harmony];
    const root = document.documentElement;

    // Apply colors to CSS variables
    root.style.setProperty("--primary", preset.colors.primary);
    root.style.setProperty("--secondary", preset.colors.secondary);
    root.style.setProperty("--accent", preset.colors.accent);

    // Update secondary-foreground based on lightness
    const secondaryLightness = parseInt(preset.colors.secondary.split(" ")[2]);
    root.style.setProperty(
      "--secondary-foreground",
      secondaryLightness > 60 ? "0 0% 10%" : "0 0% 100%"
    );

    // Save to localStorage
    localStorage.setItem("colorHarmony", harmony);
    setSelectedHarmony(harmony);
  };

  const handleSelectHarmony = (harmony: ColorHarmony) => {
    applyColorHarmony(harmony);
    setIsOpen(false);
  };

  return (
    <>
      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 right-6 z-50 w-14 h-14 rounded-full shadow-elegant bg-gradient-primary backdrop-blur-xl border-2 border-primary/30 hover:scale-110 transition-all duration-300"
        size="icon"
      >
        <Palette className="h-6 w-6 text-primary-foreground" />
      </Button>

      {/* Selector Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-300">
          <Card className="w-full max-w-3xl max-h-[80vh] overflow-y-auto bg-card/95 backdrop-blur-xl border-2 border-primary/20 shadow-elegant animate-in slide-in-from-bottom duration-500">
            <div className="sticky top-0 bg-gradient-primary p-6 flex items-center justify-between border-b-2 border-primary/30 z-10">
              <div>
                <h2 className="text-2xl font-bold text-primary-foreground glass-text">
                  Color Harmony Presets
                </h2>
                <p className="text-sm text-primary-foreground/80 glass-text mt-1">
                  Choose a color scheme based on color theory
                </p>
              </div>
              <Button
                onClick={() => setIsOpen(false)}
                variant="ghost"
                size="icon"
                className="text-primary-foreground hover:bg-primary-foreground/20"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="p-6 space-y-4">
              {Object.entries(COLOR_HARMONIES).map(([key, preset]) => {
                const isSelected = selectedHarmony === key;
                return (
                  <Card
                    key={key}
                    className={`p-6 cursor-pointer transition-all duration-300 border-2 ${
                      isSelected
                        ? "border-primary shadow-glow-cosmic bg-primary/5"
                        : "border-border hover:border-primary/50 hover:shadow-glow-cosmic/50"
                    }`}
                    onClick={() => handleSelectHarmony(key as ColorHarmony)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-foreground glass-text">
                            {preset.name}
                          </h3>
                          {isSelected && (
                            <Badge className="bg-primary text-primary-foreground">
                              <Check className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground glass-text mb-4">
                          {preset.description}
                        </p>

                        {/* Color Preview */}
                        <div className="flex gap-3">
                          <div className="flex-1 space-y-2">
                            <div
                              className="h-16 rounded-lg shadow-lg border-2 border-white/20 backdrop-blur-sm"
                              style={{ background: `hsl(${preset.colors.primary})` }}
                            />
                            <p className="text-xs text-center text-muted-foreground glass-text font-mono">
                              Primary
                            </p>
                          </div>
                          <div className="flex-1 space-y-2">
                            <div
                              className="h-16 rounded-lg shadow-lg border-2 border-white/20 backdrop-blur-sm"
                              style={{ background: `hsl(${preset.colors.secondary})` }}
                            />
                            <p className="text-xs text-center text-muted-foreground glass-text font-mono">
                              Secondary
                            </p>
                          </div>
                          <div className="flex-1 space-y-2">
                            <div
                              className="h-16 rounded-lg shadow-lg border-2 border-white/20 backdrop-blur-sm"
                              style={{ background: `hsl(${preset.colors.accent})` }}
                            />
                            <p className="text-xs text-center text-muted-foreground glass-text font-mono">
                              Accent
                            </p>
                          </div>
                        </div>
                      </div>

                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectHarmony(key as ColorHarmony);
                        }}
                        variant={isSelected ? "default" : "outline"}
                        className={isSelected ? "bg-primary text-primary-foreground" : ""}
                      >
                        {isSelected ? "Applied" : "Apply"}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>

            <div className="sticky bottom-0 bg-card/95 backdrop-blur-xl p-6 border-t-2 border-border">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground glass-text">
                  💡 Changes are saved automatically and persist across sessions
                </p>
                <Button onClick={() => setIsOpen(false)} variant="outline">
                  Close
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
