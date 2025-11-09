import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  color: string; // Aurora color for this particle
  hue: number; // For dynamic color shifting
}

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Aurora color palette for cyberpunk vibes
    const auroraColors = [
      { h: 189, s: 100, l: 50 }, // Cyan
      { h: 280, s: 100, l: 60 }, // Purple
      { h: 326, s: 100, l: 55 }, // Magenta
      { h: 160, s: 70, l: 55 }, // Teal
      { h: 230, s: 100, l: 60 }, // Electric Blue
    ];
    
    const hsla = (h: number, s: number, l: number, a: number) => 
      `hsla(${h}, ${s}%, ${l}%, ${Math.max(0, Math.min(1, a))})`;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Create aurora particles with varied colors
    const createParticles = () => {
      const particles: Particle[] = [];
      const particleCount = Math.floor((canvas.width * canvas.height) / 12000);
      
      for (let i = 0; i < particleCount; i++) {
        const colorIndex = Math.floor(Math.random() * auroraColors.length);
        const baseColor = auroraColors[colorIndex];
        
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 2.5 + 0.8,
          speedX: (Math.random() - 0.5) * 0.8,
          speedY: (Math.random() - 0.5) * 0.8,
          opacity: Math.random() * 0.6 + 0.3,
          color: `hsl(${baseColor.h}, ${baseColor.s}%, ${baseColor.l}%)`,
          hue: baseColor.h,
        });
      }
      return particles;
    };

    particlesRef.current = createParticles();

    // Animation loop
    const animate = () => {
      if (!ctx || !canvas) return;

      // Clear canvas with deep space fade
      ctx.fillStyle = "rgba(15, 18, 35, 0.08)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw and update aurora particles
      particlesRef.current.forEach((particle) => {
        // Dynamic hue shift for aurora effect
        const shiftedHue = particle.hue + (Math.sin(Date.now() / 3000 + particle.x) * 10);
        
        // Draw particle core
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = hsla(shiftedHue, 100, 60, particle.opacity);
        ctx.fill();

        // Draw enhanced glow effect
        const gradient = ctx.createRadialGradient(
          particle.x,
          particle.y,
          0,
          particle.x,
          particle.y,
          particle.size * 5
        );
        gradient.addColorStop(0, hsla(shiftedHue, 100, 65, particle.opacity * 0.7));
        gradient.addColorStop(0.5, hsla(shiftedHue, 100, 60, particle.opacity * 0.3));
        gradient.addColorStop(1, hsla(shiftedHue, 100, 55, 0));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * 5, 0, Math.PI * 2);
        ctx.fill();

        // Update position
        particle.x += particle.speedX;
        particle.y += particle.speedY;

        // Wrap around edges
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;
      });

      // Draw aurora connections between nearby particles
      particlesRef.current.forEach((particle, i) => {
        particlesRef.current.slice(i + 1).forEach((otherParticle) => {
          const dx = particle.x - otherParticle.x;
          const dy = particle.y - otherParticle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 120) {
            const avgHue = (particle.hue + otherParticle.hue) / 2;
            const connectionOpacity = 0.2 * (1 - distance / 120);
            
            ctx.beginPath();
            ctx.strokeStyle = hsla(avgHue, 95, 60, connectionOpacity);
            ctx.lineWidth = 1;
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(otherParticle.x, otherParticle.y);
            ctx.stroke();
          }
        });
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <>
      {/* Canvas for particles */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-0"
        style={{ opacity: 0.4 }}
      />
      
      {/* Grid pattern overlay */}
      <div className="fixed inset-0 pointer-events-none z-0 grid-pattern opacity-10" />
      
      {/* Aurora gradient orbs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-0 -left-1/4 w-[600px] h-[600px] bg-gradient-to-br from-cyan-500/30 via-blue-500/20 to-transparent rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-0 -right-1/4 w-[700px] h-[700px] bg-gradient-to-tl from-purple-500/30 via-pink-500/20 to-transparent rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />
        <div className="absolute top-1/2 left-1/3 w-[500px] h-[500px] bg-gradient-to-br from-teal-500/25 via-cyan-500/15 to-transparent rounded-full blur-3xl animate-float" style={{ animationDelay: "4s" }} />
        <div className="absolute bottom-1/4 right-1/3 w-[550px] h-[550px] bg-gradient-to-tl from-indigo-500/25 via-purple-500/15 to-transparent rounded-full blur-3xl animate-float" style={{ animationDelay: "6s" }} />
      </div>

      {/* Scan lines effect */}
      <div className="fixed inset-0 pointer-events-none z-0 scan-line opacity-5" />
    </>
  );
}
