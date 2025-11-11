import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useShareholder } from "@/hooks/useShareholder";
import { useParallax } from "@/hooks/useParallax";
import { Button } from "@/components/ui/button";
import { Shield, Lock, Users, Zap, Hexagon, Cpu, Sparkles, Orbit, Rocket, Satellite, Globe, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
const Index = () => {
  const {
    user
  } = useAuth();
  const navigate = useNavigate();
  const {
    isShareholder,
    isLoading: shLoading
  } = useShareholder();

  // Parallax effects with different speeds for depth
  const parallax1 = useParallax(0.2);
  const parallax2 = useParallax(0.3);
  const parallax3 = useParallax(0.4);
  const parallax4 = useParallax(0.5);
  const parallax5 = useParallax(0.15);
  useEffect(() => {
    if (user && !shLoading) {
      navigate(isShareholder ? "/shareholder/dashboard" : "/dashboard");
    }
  }, [user, isShareholder, shLoading, navigate]);
  return <div className="min-h-screen bg-gradient-hero animate-gradient relative overflow-hidden">
      {/* Grid Pattern Background */}
      <div className="absolute inset-0 grid-pattern opacity-20"></div>
      
      {/* Animated Radial Gradients - Aurora Style */}
      <div className="absolute inset-0 bg-gradient-radial pointer-events-none"></div>
      <div className="absolute top-0 left-1/4 w-[900px] h-[900px] bg-gradient-radial-bright opacity-50 blur-3xl animate-pulse-glow pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-[900px] h-[900px] bg-gradient-radial-bright opacity-50 blur-3xl animate-pulse-glow pointer-events-none" style={{
      animationDelay: '1s'
    }}></div>
      <div className="absolute top-1/2 left-1/2 w-[700px] h-[700px] bg-gradient-aurora opacity-40 blur-3xl animate-pulse-glow pointer-events-none" style={{
      animationDelay: '2s'
    }}></div>
      
      {/* Shooting Stars */}
      <div className="shooting-star" style={{
      top: '10%',
      right: '80%',
      animationDelay: '0s',
      animationDuration: '3s'
    }}></div>
      <div className="shooting-star" style={{
      top: '25%',
      right: '60%',
      animationDelay: '2s',
      animationDuration: '4s'
    }}></div>
      <div className="shooting-star" style={{
      top: '40%',
      right: '90%',
      animationDelay: '4s',
      animationDuration: '3.5s'
    }}></div>
      <div className="shooting-star" style={{
      top: '60%',
      right: '70%',
      animationDelay: '6s',
      animationDuration: '3s'
    }}></div>
      <div className="shooting-star" style={{
      top: '15%',
      right: '40%',
      animationDelay: '8s',
      animationDuration: '4s'
    }}></div>
      <div className="shooting-star" style={{
      top: '75%',
      right: '85%',
      animationDelay: '10s',
      animationDuration: '3.5s'
    }}></div>
      
      {/* Space Theme Background Icons with Parallax */}
      <div className="absolute top-10 right-1/4 opacity-10 animate-float transition-transform duration-100" style={{
      transform: `translateY(${parallax1}px)`
    }}>
        <Rocket className="w-20 h-20 text-primary rotate-45" strokeWidth={1.5} />
      </div>
      <div className="absolute top-1/3 left-10 opacity-8 animate-float transition-transform duration-100" style={{
      animationDelay: '1s',
      transform: `translateY(${parallax2}px)`
    }}>
        <Satellite className="w-16 h-16 text-secondary" strokeWidth={1.5} />
      </div>
      <div className="absolute bottom-1/4 right-10 opacity-10 animate-float transition-transform duration-100" style={{
      animationDelay: '2s',
      transform: `translateY(${parallax3}px)`
    }}>
        <Globe className="w-24 h-24 text-accent" strokeWidth={1.5} />
      </div>
      <div className="absolute top-1/2 right-1/3 opacity-8 animate-float transition-transform duration-100" style={{
      animationDelay: '0.5s',
      transform: `translateY(${parallax4}px)`
    }}>
        <Orbit className="w-20 h-20 text-primary" strokeWidth={1.5} />
      </div>
      <div className="absolute bottom-20 left-1/4 opacity-6 animate-float transition-transform duration-100" style={{
      animationDelay: '1.5s',
      transform: `translateY(${parallax5}px)`
    }}>
        <Sparkles className="w-12 h-12 text-primary" strokeWidth={1.5} />
      </div>
      
      {/* Floating Stars */}
      <div className="absolute top-20 left-1/3 opacity-30 animate-pulse">
        <Star className="w-6 h-6 text-cyan-300 fill-cyan-300" />
      </div>
      <div className="absolute top-40 right-1/4 opacity-40 animate-pulse" style={{
      animationDelay: '0.5s'
    }}>
        <Star className="w-4 h-4 text-purple-300 fill-purple-300" />
      </div>
      <div className="absolute bottom-1/3 left-1/4 opacity-35 animate-pulse" style={{
      animationDelay: '1s'
    }}>
        <Star className="w-5 h-5 text-pink-300 fill-pink-300" />
      </div>
      <div className="absolute top-1/4 left-1/2 opacity-30 animate-pulse" style={{
      animationDelay: '1.5s'
    }}>
        <Star className="w-4 h-4 text-cyan-400 fill-cyan-400" />
      </div>
      <div className="absolute bottom-40 right-1/3 opacity-40 animate-pulse" style={{
      animationDelay: '2s'
    }}>
        <Star className="w-5 h-5 text-purple-400 fill-purple-400" />
      </div>
      
      {/* Geometric Shapes with Parallax */}
      <div className="absolute top-20 right-20 w-24 h-24 border border-accent/20 rounded-full animate-float transition-transform duration-100" style={{
      animationDelay: '2s',
      transform: `translateY(${parallax4}px)`
    }}></div>
      <div className="absolute top-1/2 left-10 w-16 h-16 transition-transform duration-100" style={{
      transform: `translateY(${parallax3}px)`
    }}>
        <Hexagon className="w-full h-full text-primary/10 animate-float" style={{
        animationDelay: '1.5s'
      }} />
      </div>
      <div className="absolute bottom-20 right-1/4 w-20 h-20 transition-transform duration-100" style={{
      transform: `translateY(${parallax1}px)`
    }}>
        <Cpu className="w-full h-full text-secondary/10 animate-float" style={{
        animationDelay: '0.5s'
      }} />
      </div>
      
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 flex flex-col items-center justify-center min-h-[80vh] relative z-10">
        <div className="text-center max-w-5xl mx-auto space-y-10 animate-in">
          {/* Main Icon with Neon Effect */}
          <div className="mx-auto w-28 h-28 rounded-3xl bg-gradient-neon backdrop-blur-sm flex items-center justify-center mb-8 shadow-neon hover:scale-110 transition-all duration-500 animate-pulse-glow relative scan-line">
            <Shield className="w-14 h-14 text-white drop-shadow-2xl" strokeWidth={2.5} />
          </div>

          {/* Heading with Cyber Font Style */}
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-px w-12 bg-gradient-neon"></div>
              <Zap className="w-6 h-6 text-primary animate-pulse" />
              <div className="h-px w-12 bg-gradient-neon"></div>
            </div>
            <h1 className="text-6xl font-black text-white mb-6 tracking-tighter drop-shadow-2xl relative md:text-7xl">
              <span style={{
              fontWeight: 950,
              WebkitTextStroke: '2px rgba(6, 182, 212, 0.8)',
              textShadow: '0 0 30px rgba(6, 182, 212, 1), 0 0 60px rgba(6, 182, 212, 0.8), 0 0 90px rgba(6, 182, 212, 0.6), 0 4px 12px rgba(0, 0, 0, 0.8)'
            }} className="text-white tracking-wide font-orbitron text-9xl font-extrabold">PayX</span>
              <br />
              <span className="text-white/90 font-inter text-6xl">Power Your Payment</span>
            </h1>
            <div className="flex items-center justify-center gap-2">
              <div className="h-1 w-20 bg-primary shadow-neon"></div>
              <div className="h-1 w-4 bg-secondary"></div>
              <div className="h-1 w-20 bg-accent shadow-neon"></div>
            </div>
          </div>
          
          <p className="text-xl md:text-2xl text-cyan-200 mb-10 font-light drop-shadow-lg tracking-wide">
            ระบบจัดการการชำระเงิน <span className="text-primary font-semibold">NEXT-GEN</span> สำหรับองค์กร
          </p>

          {/* Feature Cards - Futuristic Style */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16 mb-16">
            {/* Card 1 */}
            <Card className="group p-8 bg-black/40 backdrop-blur-xl border-2 border-primary/30 shadow-glow hover:shadow-neon hover:scale-105 hover:border-primary/60 transition-all duration-500 cursor-pointer relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-10 transition-opacity duration-500"></div>
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-neon"></div>
              <div className="relative z-10 space-y-4">
                <div className="w-20 h-20 rounded-2xl bg-gradient-info flex items-center justify-center mx-auto shadow-glow-info animate-pulse-glow">
                  <Lock className="w-10 h-10 text-white drop-shadow-md" strokeWidth={2.5} />
                </div>
                <h3 className="text-2xl font-black text-cyan-200 tracking-tight">
                  INVITE-ONLY
                </h3>
                <p className="text-sm text-cyan-100/80 leading-relaxed font-light">
                  ระบบรักษาความปลอดภัย<br />ด้วย Administrator Control
                </p>
                <div className="flex justify-center gap-1 pt-2">
                  <div className="w-2 h-2 rounded-full bg-primary shadow-neon"></div>
                  <div className="w-2 h-2 rounded-full bg-secondary"></div>
                  <div className="w-2 h-2 rounded-full bg-accent"></div>
                </div>
              </div>
            </Card>

            {/* Card 2 */}
            <Card className="group p-8 bg-black/40 backdrop-blur-xl border-2 border-secondary/30 shadow-glow hover:shadow-neon hover:scale-105 hover:border-secondary/60 transition-all duration-500 cursor-pointer relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-10 transition-opacity duration-500"></div>
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-neon"></div>
              <div className="relative z-10 space-y-4">
                <div className="w-20 h-20 rounded-2xl bg-gradient-primary flex items-center justify-center mx-auto shadow-glow animate-pulse-glow" style={{
                animationDelay: '0.5s'
              }}>
                  <Shield className="w-10 h-10 text-white drop-shadow-md" strokeWidth={2.5} />
                </div>
                <h3 className="text-2xl font-black text-purple-200 tracking-tight">
                  ULTRA SECURE
                </h3>
                <p className="text-sm text-purple-100/80 leading-relaxed font-light">
                  Enterprise-Grade Security<br />พร้อม 2FA & SSL Encryption
                </p>
                <div className="flex justify-center gap-1 pt-2">
                  <div className="w-2 h-2 rounded-full bg-primary shadow-neon"></div>
                  <div className="w-2 h-2 rounded-full bg-secondary"></div>
                  <div className="w-2 h-2 rounded-full bg-accent"></div>
                </div>
              </div>
            </Card>

            {/* Card 3 */}
            <Card className="group p-8 bg-black/40 backdrop-blur-xl border-2 border-accent/30 shadow-glow hover:shadow-neon hover:scale-105 hover:border-accent/60 transition-all duration-500 cursor-pointer relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-10 transition-opacity duration-500"></div>
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-neon"></div>
              <div className="relative z-10 space-y-4">
                <div className="w-20 h-20 rounded-2xl bg-gradient-users flex items-center justify-center mx-auto shadow-glow animate-pulse-glow" style={{
                animationDelay: '1s'
              }}>
                  <Users className="w-10 h-10 text-white drop-shadow-md" strokeWidth={2.5} />
                </div>
                <h3 className="text-2xl font-black text-pink-200 tracking-tight">
                  MULTI-TENANT
                </h3>
                <p className="text-sm text-pink-100/80 leading-relaxed font-light">
                  รองรับการจัดการ<br />หลายองค์กรในระบบเดียว
                </p>
                <div className="flex justify-center gap-1 pt-2">
                  <div className="w-2 h-2 rounded-full bg-primary shadow-neon"></div>
                  <div className="w-2 h-2 rounded-full bg-secondary"></div>
                  <div className="w-2 h-2 rounded-full bg-accent"></div>
                </div>
              </div>
            </Card>
          </div>

          {/* CTA Button */}
          <div className="space-y-6 mt-12">
            <Button variant="default" size="lg" onClick={() => navigate("/auth/sign-in")} className="group relative text-xl px-16 py-8 bg-gradient-neon text-white hover:shadow-neon transition-all duration-500 font-black tracking-wider border-2 border-primary/50 hover:border-primary overflow-hidden scan-line">
              <span className="relative z-10 flex items-center gap-3">
                <Zap className="w-6 h-6 group-hover:animate-pulse" />
                เข้าสู่ระบบ
                <Zap className="w-6 h-6 group-hover:animate-pulse" />
              </span>
            </Button>
            
            <p className="text-base text-cyan-300/80 font-light tracking-wide">
              [ AUTHORIZED PERSONNEL ONLY ] หากคุณได้รับ invitation code กรุณาติดต่อ Administrator
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-primary/20 py-12 px-4 backdrop-blur-xl bg-black/30 relative z-10">
        <div className="container mx-auto max-w-6xl">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="h-px w-20 bg-gradient-neon"></div>
            <Shield className="w-6 h-6 text-primary animate-pulse" />
            <div className="h-px w-20 bg-gradient-neon"></div>
          </div>
          <p className="text-sm text-cyan-200/70 font-light drop-shadow-md text-center tracking-wider">
            © 2024 PAYMENT COMMAND • SECURED BY SSL ENCRYPTION • ALL SYSTEMS OPERATIONAL
          </p>
        </div>
      </footer>
    </div>;
};
export default Index;