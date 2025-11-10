import { useEffect, useRef } from "react";
import { useParallax } from "@/hooks/useParallax";

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  color: string;
  hue: number;
}

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  twinkleSpeed: number;
  twinkleOffset: number;
}

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const starsRef = useRef<Star[]>([]);
  const animationFrameRef = useRef<number>();
  
  // Parallax effects with different speeds for depth
  const parallaxSlow = useParallax(0.1);
  const parallaxMedium = useParallax(0.2);
  const parallaxFast = useParallax(0.3);
  const parallaxVeryFast = useParallax(0.4);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Red Spider Nebula + Aurora color palette
    const cosmicColors = [
      { h: 0, s: 95, l: 55 },    // Nebula Red
      { h: 15, s: 100, l: 60 },  // Nebula Orange
      { h: 340, s: 95, l: 65 },  // Nebula Pink
      { h: 189, s: 100, l: 50 }, // Aurora Cyan
      { h: 280, s: 100, l: 60 }, // Aurora Purple
      { h: 326, s: 100, l: 55 }, // Aurora Magenta
      { h: 160, s: 70, l: 55 },  // Aurora Teal
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

    // Create star field
    const createStars = () => {
      const stars: Star[] = [];
      const starCount = Math.floor((canvas.width * canvas.height) / 8000);
      
      for (let i = 0; i < starCount; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 1.5 + 0.3,
          opacity: Math.random() * 0.8 + 0.2,
          twinkleSpeed: Math.random() * 0.02 + 0.01,
          twinkleOffset: Math.random() * Math.PI * 2,
        });
      }
      return stars;
    };

    // Create cosmic particles (nebula + aurora)
    const createParticles = () => {
      const particles: Particle[] = [];
      const particleCount = Math.floor((canvas.width * canvas.height) / 10000);
      
      for (let i = 0; i < particleCount; i++) {
        const colorIndex = Math.floor(Math.random() * cosmicColors.length);
        const baseColor = cosmicColors[colorIndex];
        
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 2.8 + 0.8,
          speedX: (Math.random() - 0.5) * 0.6,
          speedY: (Math.random() - 0.5) * 0.6,
          opacity: Math.random() * 0.7 + 0.3,
          color: `hsl(${baseColor.h}, ${baseColor.s}%, ${baseColor.l}%)`,
          hue: baseColor.h,
        });
      }
      return particles;
    };

    starsRef.current = createStars();
    particlesRef.current = createParticles();

    // Animation loop
    const animate = () => {
      if (!ctx || !canvas) return;

      // Clear canvas with deep space fade
      ctx.fillStyle = "rgba(10, 12, 25, 0.1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw twinkling stars
      const time = Date.now() * 0.001;
      starsRef.current.forEach((star) => {
        const twinkle = Math.sin(time * star.twinkleSpeed + star.twinkleOffset) * 0.5 + 0.5;
        const currentOpacity = star.opacity * twinkle;
        
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = hsla(200, 100, 90, currentOpacity);
        ctx.fill();
        
        // Star glow
        if (currentOpacity > 0.6) {
          const glowGradient = ctx.createRadialGradient(
            star.x, star.y, 0,
            star.x, star.y, star.size * 3
          );
          glowGradient.addColorStop(0, hsla(200, 100, 95, currentOpacity * 0.5));
          glowGradient.addColorStop(1, hsla(200, 100, 90, 0));
          ctx.fillStyle = glowGradient;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Draw and update cosmic particles (nebula + aurora)
      particlesRef.current.forEach((particle) => {
        // Dynamic hue shift for cosmic effect
        const shiftedHue = particle.hue + (Math.sin(Date.now() / 3000 + particle.x) * 8);
        
        // Draw particle core
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = hsla(shiftedHue, 100, 60, particle.opacity);
        ctx.fill();

        // Draw enhanced glow effect with nebula colors
        const gradient = ctx.createRadialGradient(
          particle.x,
          particle.y,
          0,
          particle.x,
          particle.y,
          particle.size * 6
        );
        gradient.addColorStop(0, hsla(shiftedHue, 100, 65, particle.opacity * 0.8));
        gradient.addColorStop(0.4, hsla(shiftedHue, 100, 60, particle.opacity * 0.4));
        gradient.addColorStop(1, hsla(shiftedHue, 100, 55, 0));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * 6, 0, Math.PI * 2);
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

      // Draw connections between nearby particles
      particlesRef.current.forEach((particle, i) => {
        particlesRef.current.slice(i + 1).forEach((otherParticle) => {
          const dx = particle.x - otherParticle.x;
          const dy = particle.y - otherParticle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 100) {
            const avgHue = (particle.hue + otherParticle.hue) / 2;
            const connectionOpacity = 0.25 * (1 - distance / 100);
            
            ctx.beginPath();
            ctx.strokeStyle = hsla(avgHue, 95, 60, connectionOpacity);
            ctx.lineWidth = 1.2;
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
      {/* Canvas for particles and stars */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-0"
        style={{ opacity: 0.5 }}
      />
      
      {/* Grid pattern overlay */}
      <div className="fixed inset-0 pointer-events-none z-0 grid-pattern opacity-5" />
      
      {/* Nebula layers - Red Spider Nebula inspired with Parallax */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Red nebula core - Slowest (far background) */}
        <div 
          className="absolute top-1/4 -left-1/4 w-[800px] h-[800px] rounded-full blur-3xl animate-nebula-pulse transition-transform duration-100 ease-out"
          style={{
            background: 'radial-gradient(ellipse at center, hsl(0 95% 55% / 0.35) 0%, hsl(15 100% 60% / 0.25) 40%, transparent 70%)',
            transform: `translateY(${parallaxSlow}px)`,
          }}
        />
        
        {/* Orange nebula dust - Slow-medium */}
        <div 
          className="absolute top-1/3 right-1/4 w-[700px] h-[700px] rounded-full blur-3xl animate-nebula-pulse transition-transform duration-100 ease-out"
          style={{
            background: 'radial-gradient(circle at center, hsl(15 100% 60% / 0.3) 0%, hsl(340 95% 65% / 0.2) 50%, transparent 75%)',
            animationDelay: '2s',
            transform: `translateY(${parallaxMedium}px)`,
          }}
        />
        
        {/* Pink nebula wisps - Medium */}
        <div 
          className="absolute bottom-1/4 left-1/3 w-[650px] h-[650px] rounded-full blur-3xl animate-nebula-pulse transition-transform duration-100 ease-out"
          style={{
            background: 'radial-gradient(ellipse at center, hsl(340 95% 65% / 0.28) 0%, hsl(355 85% 45% / 0.18) 60%, transparent 80%)',
            animationDelay: '4s',
            transform: `translateY(${parallaxMedium}px)`,
          }}
        />
        
        {/* Aurora cyan orb - Fast (closer) */}
        <div 
          className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-3xl animate-float transition-transform duration-100 ease-out"
          style={{
            background: 'radial-gradient(circle at center, hsl(189 100% 50% / 0.25) 0%, hsl(160 70% 55% / 0.15) 50%, transparent 75%)',
            animationDelay: '1s',
            transform: `translateY(${parallaxFast}px)`,
          }}
        />
        
        {/* Aurora purple orb - Very fast (closest) */}
        <div 
          className="absolute bottom-0 -right-1/4 w-[700px] h-[700px] rounded-full blur-3xl animate-float transition-transform duration-100 ease-out"
          style={{
            background: 'radial-gradient(ellipse at center, hsl(280 100% 60% / 0.28) 0%, hsl(230 100% 60% / 0.18) 60%, transparent 80%)',
            animationDelay: '3s',
            transform: `translateY(${parallaxVeryFast}px)`,
          }}
        />
        
        {/* Deep space vortex center - Medium depth */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-3xl animate-nebula-pulse transition-transform duration-100 ease-out"
          style={{
            background: 'radial-gradient(circle at center, hsl(355 85% 45% / 0.2) 0%, hsl(280 100% 60% / 0.15) 40%, hsl(189 100% 50% / 0.1) 70%, transparent 100%)',
            animationDelay: '5s',
            transform: `translateY(${parallaxMedium}px) translateX(-50%)`,
          }}
        />
      </div>

      {/* Scan lines effect */}
      <div className="fixed inset-0 pointer-events-none z-0 scan-line opacity-5" />
    </>
  );
}