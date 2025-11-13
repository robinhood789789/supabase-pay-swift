import { Shield, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const SignInLoadingSkeleton = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero animate-gradient px-4 relative overflow-hidden">
      {/* Grid Pattern Background */}
      <div className="absolute inset-0 grid-pattern opacity-20"></div>
      
      {/* Animated Radial Gradients */}
      <div className="absolute inset-0 bg-gradient-radial pointer-events-none"></div>
      
      {/* Floating Particles */}
      <div className="particle particle-1" style={{ top: '10%', left: '15%' }}></div>
      <div className="particle particle-2" style={{ top: '20%', right: '20%' }}></div>
      <div className="particle particle-3" style={{ top: '30%', left: '30%' }}></div>
      
      <div className="absolute top-0 left-1/4 w-[900px] h-[900px] bg-gradient-radial-bright opacity-50 blur-3xl animate-pulse-glow pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-[900px] h-[900px] bg-gradient-radial-bright opacity-50 blur-3xl animate-pulse-glow pointer-events-none" style={{ animationDelay: '1s' }}></div>
      
      <Card className="w-full max-w-md shadow-neon relative z-10 bg-black/40 backdrop-blur-xl border-2 border-primary/30">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-neon backdrop-blur-sm flex items-center justify-center mb-4 shadow-neon animate-pulse-glow">
            <Shield className="w-8 h-8 text-white drop-shadow-lg" strokeWidth={2.5} />
          </div>
          
          <div className="flex flex-col items-center space-y-3">
            <Skeleton className="h-8 w-32 bg-cyan-500/20 animate-pulse" />
            <Skeleton className="h-4 w-48 bg-cyan-500/10 animate-pulse" />
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Authenticating Message */}
          <div className="flex flex-col items-center justify-center py-8 space-y-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-neon rounded-full blur-xl opacity-50 animate-pulse-glow"></div>
              <Loader2 className="w-16 h-16 text-primary animate-spin relative z-10" strokeWidth={2} />
            </div>
            
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-cyan-200 animate-pulse">
                กำลังยืนยันตัวตน...
              </h3>
              <p className="text-sm text-cyan-300/70">
                โปรดรอสักครู่
              </p>
            </div>
            
            {/* Animated Progress Bars */}
            <div className="w-full space-y-3">
              <div className="space-y-2">
                <Skeleton className="h-2 w-full bg-cyan-500/20 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-neon animate-shimmer" style={{ 
                    backgroundSize: '200% 100%',
                    width: '100%'
                  }}></div>
                </Skeleton>
              </div>
              
              <div className="space-y-2">
                <Skeleton className="h-2 w-3/4 bg-purple-500/20 rounded-full overflow-hidden" style={{ animationDelay: '0.2s' }}>
                  <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 animate-shimmer" style={{ 
                    backgroundSize: '200% 100%',
                    width: '100%',
                    animationDelay: '0.2s'
                  }}></div>
                </Skeleton>
              </div>
              
              <div className="space-y-2">
                <Skeleton className="h-2 w-1/2 bg-pink-500/20 rounded-full overflow-hidden" style={{ animationDelay: '0.4s' }}>
                  <div className="h-full bg-gradient-to-r from-pink-500 to-cyan-500 animate-shimmer" style={{ 
                    backgroundSize: '200% 100%',
                    width: '100%',
                    animationDelay: '0.4s'
                  }}></div>
                </Skeleton>
              </div>
            </div>
          </div>

          {/* Security Badge */}
          <div className="flex items-center justify-center gap-2 text-xs text-cyan-300/60 pt-4 border-t border-cyan-500/20">
            <div className="w-2 h-2 rounded-full bg-primary shadow-neon animate-pulse"></div>
            <span>Secure Authentication in Progress</span>
            <div className="w-2 h-2 rounded-full bg-primary shadow-neon animate-pulse"></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
