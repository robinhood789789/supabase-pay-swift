import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Star {
  x: number;
  y: number;
  brightness: number;
}

interface Constellation {
  name: string;
  description: string;
  stars: Star[];
  connections: [number, number][]; // Pairs of star indices to connect
  position: { x: number; y: number }; // Top-left position as percentage
}

const constellations: Constellation[] = [
  {
    name: "Orion",
    description: "The Hunter - One of the most recognizable constellations",
    position: { x: 15, y: 20 },
    stars: [
      { x: 50, y: 20, brightness: 1 },
      { x: 40, y: 40, brightness: 0.9 },
      { x: 60, y: 40, brightness: 0.9 },
      { x: 45, y: 60, brightness: 0.8 },
      { x: 50, y: 65, brightness: 0.7 },
      { x: 55, y: 60, brightness: 0.8 },
      { x: 50, y: 80, brightness: 0.95 },
    ],
    connections: [
      [0, 1], [0, 2], [1, 3], [2, 5], [3, 4], [4, 5], [4, 6]
    ],
  },
  {
    name: "Ursa Major",
    description: "The Great Bear - Contains the Big Dipper asterism",
    position: { x: 60, y: 15 },
    stars: [
      { x: 20, y: 40, brightness: 0.9 },
      { x: 30, y: 35, brightness: 0.85 },
      { x: 45, y: 35, brightness: 0.9 },
      { x: 60, y: 40, brightness: 0.85 },
      { x: 65, y: 55, brightness: 0.8 },
      { x: 55, y: 65, brightness: 0.85 },
      { x: 40, y: 60, brightness: 0.8 },
    ],
    connections: [
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 2]
    ],
  },
  {
    name: "Cassiopeia",
    description: "The Queen - Distinctive W-shaped constellation",
    position: { x: 70, y: 60 },
    stars: [
      { x: 20, y: 50, brightness: 0.9 },
      { x: 35, y: 35, brightness: 0.85 },
      { x: 50, y: 45, brightness: 0.9 },
      { x: 65, y: 30, brightness: 0.85 },
      { x: 80, y: 45, brightness: 0.8 },
    ],
    connections: [
      [0, 1], [1, 2], [2, 3], [3, 4]
    ],
  },
  {
    name: "Lyra",
    description: "The Lyre - Home to the bright star Vega",
    position: { x: 25, y: 65 },
    stars: [
      { x: 50, y: 30, brightness: 1 },
      { x: 40, y: 50, brightness: 0.7 },
      { x: 60, y: 50, brightness: 0.7 },
      { x: 45, y: 70, brightness: 0.6 },
      { x: 55, y: 70, brightness: 0.6 },
    ],
    connections: [
      [0, 1], [0, 2], [1, 3], [2, 4], [3, 4]
    ],
  },
];

export function ConstellationOverlay() {
  const [hoveredConstellation, setHoveredConstellation] = useState<string | null>(null);

  return (
    <TooltipProvider>
      <div className="fixed inset-0 pointer-events-none z-[5]">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            {/* Glow filter for stars */}
            <filter id="starGlow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            
            {/* Glow filter for lines */}
            <filter id="lineGlow">
              <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {constellations.map((constellation) => {
            const isHovered = hoveredConstellation === constellation.name;
            const baseX = (constellation.position.x / 100) * (typeof window !== 'undefined' ? window.innerWidth : 1920);
            const baseY = (constellation.position.y / 100) * (typeof window !== 'undefined' ? window.innerHeight : 1080);
            const scale = 1.5;

            return (
              <g 
                key={constellation.name}
                className="pointer-events-auto cursor-pointer transition-opacity duration-300"
                style={{ opacity: hoveredConstellation && !isHovered ? 0.3 : 1 }}
                onMouseEnter={() => setHoveredConstellation(constellation.name)}
                onMouseLeave={() => setHoveredConstellation(null)}
              >
                {/* Connection lines */}
                {constellation.connections.map(([startIdx, endIdx], idx) => {
                  const start = constellation.stars[startIdx];
                  const end = constellation.stars[endIdx];
                  const x1 = baseX + (start.x * scale);
                  const y1 = baseY + (start.y * scale);
                  const x2 = baseX + (end.x * scale);
                  const y2 = baseY + (end.y * scale);

                  return (
                    <line
                      key={idx}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={isHovered ? "hsl(189, 100%, 60%)" : "hsl(189, 100%, 50%)"}
                      strokeWidth={isHovered ? "1.5" : "1"}
                      opacity={isHovered ? "0.8" : "0.4"}
                      filter="url(#lineGlow)"
                      className="transition-all duration-300"
                    />
                  );
                })}

                {/* Stars */}
                {constellation.stars.map((star, idx) => {
                  const x = baseX + (star.x * scale);
                  const y = baseY + (star.y * scale);
                  const size = 2 + (star.brightness * 2);

                  return (
                    <Tooltip key={idx} delayDuration={0}>
                      <TooltipTrigger asChild>
                        <circle
                          cx={x}
                          cy={y}
                          r={isHovered ? size * 1.3 : size}
                          fill={isHovered ? "hsl(189, 100%, 90%)" : "hsl(189, 100%, 80%)"}
                          opacity={star.brightness}
                          filter="url(#starGlow)"
                          className="transition-all duration-300"
                        >
                          <animate
                            attributeName="opacity"
                            values={`${star.brightness * 0.7};${star.brightness};${star.brightness * 0.7}`}
                            dur={`${2 + Math.random() * 2}s`}
                            repeatCount="indefinite"
                          />
                        </circle>
                      </TooltipTrigger>
                      {idx === 0 && (
                        <TooltipContent 
                          side="top" 
                          className="backdrop-blur-xl bg-glass border-glass-border text-card-foreground"
                        >
                          <div className="space-y-1">
                            <p className="font-semibold text-primary">{constellation.name}</p>
                            <p className="text-xs text-muted-foreground max-w-[200px]">
                              {constellation.description}
                            </p>
                          </div>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  );
                })}

                {/* Constellation name label */}
                {isHovered && (
                  <text
                    x={baseX + (50 * scale)}
                    y={baseY - 10}
                    textAnchor="middle"
                    fill="hsl(189, 100%, 70%)"
                    fontSize="14"
                    fontWeight="600"
                    filter="url(#starGlow)"
                    className="animate-fade-in"
                    style={{ textShadow: "0 0 10px hsl(189, 100%, 50%)" }}
                  >
                    {constellation.name}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </TooltipProvider>
  );
}
