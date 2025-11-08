import { CreditCard, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const PaymentHero = () => {
  return (
    <section className="relative overflow-hidden bg-gradient-hero py-20 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-4">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">ปลอดภัย รวดเร็ว เชื่อถือได้</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-foreground leading-tight">
            ระบบชำระเงิน
            <span className="block bg-gradient-primary bg-clip-text text-transparent">
              ที่ทันสมัยที่สุด
            </span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            รับชำระเงินออนไลน์ได้ทันที รองรับทุกช่องทาง ปลอดภัยด้วยเทคโนโลยีล่าสุด
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
            <Button size="lg" variant="gradient" className="text-base px-8">
              <CreditCard className="w-5 h-5" />
              เริ่มใช้งานฟรี
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8">
              ดูตัวอย่าง
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-16">
            <div className="flex flex-col items-center space-y-3">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">รวดเร็วทันใจ</h3>
              <p className="text-sm text-muted-foreground">ชำระเงินได้ภายใน 3 วินาที</p>
            </div>

            <div className="flex flex-col items-center space-y-3">
              <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                <Shield className="w-6 h-6 text-secondary" />
              </div>
              <h3 className="font-semibold text-foreground">ปลอดภัยสูงสุด</h3>
              <p className="text-sm text-muted-foreground">เข้ารหัสข้อมูลระดับธนาคาร</p>
            </div>

            <div className="flex flex-col items-center space-y-3">
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-semibold text-foreground">รองรับทุกช่องทาง</h3>
              <p className="text-sm text-muted-foreground">บัตรเครดิต, QR Code, E-Wallet</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PaymentHero;
