import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useShareholder } from "@/hooks/useShareholder";
import { useParallax } from "@/hooks/useParallax";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Mail, Lock, Star, Sparkles, Orbit } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const signInSchema = z.object({
  publicId: z.string().min(1, { message: "User ID is required" }).regex(/^[A-Z0-9]{2,6}-\d{6}$/, { message: "Invalid User ID format (e.g., OWNR-000001)" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

const SignIn = () => {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const { isShareholder, isLoading: shLoading } = useShareholder();
  const [isLoading, setIsLoading] = useState(false);
  
  // Parallax effects
  const parallax1 = useParallax(0.2);
  const parallax2 = useParallax(0.3);
  const parallax3 = useParallax(0.4);

  const form = useForm<z.infer<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      publicId: "",
      password: "",
    },
  });

  useEffect(() => {
    if (user && !shLoading) {
      navigate(isShareholder ? "/shareholder/dashboard" : "/dashboard");
    }
  }, [user, isShareholder, shLoading, navigate]);

  const handleSubmit = async (values: z.infer<typeof signInSchema>) => {
    setIsLoading(true);
    await signIn(values.publicId, values.password);
    setIsLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero animate-gradient px-4 relative overflow-hidden">
      {/* Grid Pattern Background */}
      <div className="absolute inset-0 grid-pattern opacity-20"></div>
      
      {/* Animated Radial Gradients - Aurora Style */}
      <div className="absolute inset-0 bg-gradient-radial pointer-events-none"></div>
      
      {/* Floating Particles */}
      <div className="particle particle-1" style={{ top: '10%', left: '15%' }}></div>
      <div className="particle particle-2" style={{ top: '20%', right: '20%' }}></div>
      <div className="particle particle-3" style={{ top: '30%', left: '30%' }}></div>
      <div className="particle particle-1" style={{ top: '40%', right: '15%', animationDelay: '1s' }}></div>
      <div className="particle particle-2" style={{ top: '50%', left: '10%', animationDelay: '2s' }}></div>
      <div className="particle particle-3" style={{ top: '60%', right: '25%', animationDelay: '1.5s' }}></div>
      <div className="particle particle-1" style={{ top: '70%', left: '20%', animationDelay: '3s' }}></div>
      <div className="particle particle-2" style={{ top: '80%', right: '30%', animationDelay: '2.5s' }}></div>
      <div className="particle particle-3" style={{ top: '15%', left: '50%', animationDelay: '1s' }}></div>
      <div className="particle particle-1" style={{ top: '35%', right: '40%', animationDelay: '2s' }}></div>
      <div className="particle particle-2" style={{ top: '55%', left: '45%', animationDelay: '3s' }}></div>
      <div className="particle particle-3" style={{ top: '75%', right: '10%', animationDelay: '1.5s' }}></div>
      
      <div className="absolute top-0 left-1/4 w-[900px] h-[900px] bg-gradient-radial-bright opacity-50 blur-3xl animate-pulse-glow pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-[900px] h-[900px] bg-gradient-radial-bright opacity-50 blur-3xl animate-pulse-glow pointer-events-none" style={{ animationDelay: '1s' }}></div>
      <div className="absolute top-1/2 left-1/2 w-[700px] h-[700px] bg-gradient-aurora opacity-40 blur-3xl animate-pulse-glow pointer-events-none" style={{ animationDelay: '2s' }}></div>
      
      {/* Shooting Stars */}
      <div className="shooting-star" style={{ top: '10%', right: '80%', animationDelay: '0s', animationDuration: '3s' }}></div>
      <div className="shooting-star" style={{ top: '25%', right: '60%', animationDelay: '2s', animationDuration: '4s' }}></div>
      <div className="shooting-star" style={{ top: '60%', right: '70%', animationDelay: '4s', animationDuration: '3s' }}></div>
      
      {/* Floating Icons */}
      <div className="absolute top-20 right-20 opacity-8">
        <Sparkles className="w-12 h-12 text-primary" strokeWidth={1.5} />
      </div>
      <div className="absolute bottom-20 left-20 opacity-8">
        <Orbit className="w-16 h-16 text-secondary" strokeWidth={1.5} />
      </div>
      
      {/* Floating Stars */}
      <div className="absolute top-20 left-1/4 opacity-30 animate-pulse">
        <Star className="w-6 h-6 text-cyan-300 fill-cyan-300" />
      </div>
      <div className="absolute top-40 right-1/4 opacity-40 animate-pulse" style={{ animationDelay: '0.5s' }}>
        <Star className="w-4 h-4 text-purple-300 fill-purple-300" />
      </div>
      <div className="absolute bottom-1/3 left-1/4 opacity-35 animate-pulse" style={{ animationDelay: '1s' }}>
        <Star className="w-5 h-5 text-pink-300 fill-pink-300" />
      </div>
      
      <Card className="w-full max-w-md shadow-neon relative z-10 bg-black/40 backdrop-blur-xl border-2 border-primary/30">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-neon backdrop-blur-sm flex items-center justify-center mb-4 shadow-neon animate-pulse-glow">
            <Shield className="w-8 h-8 text-white drop-shadow-lg" strokeWidth={2.5} />
          </div>
          <CardTitle className="text-3xl font-black text-cyan-200 tracking-tight">SIGN IN</CardTitle>
          <CardDescription className="text-cyan-100/70">เข้าสู่ระบบด้วย credentials ของคุณ</CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="publicId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-cyan-200 font-semibold">User ID</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-primary" />
                        <Input 
                          placeholder="OWNR-000001" 
                          className="pl-10 uppercase bg-black/20 backdrop-blur-sm border-2 border-primary/40 text-cyan-100 placeholder:text-cyan-300/40 focus:border-primary focus:shadow-glow-info transition-all duration-300" 
                          {...field} 
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-pink-300" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-cyan-200 font-semibold">Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-primary" />
                        <Input 
                          type="password" 
                          placeholder="••••••" 
                          className="pl-10 bg-black/20 backdrop-blur-sm border-2 border-primary/40 text-cyan-100 placeholder:text-cyan-300/40 focus:border-primary focus:shadow-glow-info transition-all duration-300" 
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-pink-300" />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full bg-gradient-neon text-white hover:shadow-neon transition-all duration-500 font-bold tracking-wide border-2 border-primary/50 hover:border-primary" 
                disabled={isLoading}
              >
                {isLoading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
              </Button>
            </form>
          </Form>
        </CardContent>

        <CardFooter className="flex flex-col space-y-2">
          <p className="text-sm text-cyan-100/70 text-center">
            ยังไม่มีบัญชี?{" "}
            <Link to="/auth/sign-up" className="text-primary hover:text-primary/80 underline">
              สมัครสมาชิก
            </Link>
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-cyan-300/60">
            <div className="w-2 h-2 rounded-full bg-primary shadow-neon animate-pulse"></div>
            <span>Protected by SSL Encryption</span>
            <div className="w-2 h-2 rounded-full bg-primary shadow-neon animate-pulse"></div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default SignIn;
