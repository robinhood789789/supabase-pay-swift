import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CreditCard, Wallet, QrCode } from "lucide-react";
import { toast } from "sonner";

const PaymentForm = () => {
  const [paymentMethod, setPaymentMethod] = useState<"card" | "wallet" | "qr">("card");

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("ชำระเงินสำเร็จ!", {
      description: "คำสั่งซื้อของคุณได้รับการยืนยันแล้ว",
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl text-foreground">ข้อมูลการชำระเงิน</CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex gap-3">
          <button
            onClick={() => setPaymentMethod("card")}
            className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
              paymentMethod === "card" 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-primary/50"
            }`}
          >
            <CreditCard className={`w-6 h-6 ${paymentMethod === "card" ? "text-primary" : "text-muted-foreground"}`} />
            <span className="text-sm font-medium">บัตรเครดิต</span>
          </button>

          <button
            onClick={() => setPaymentMethod("wallet")}
            className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
              paymentMethod === "wallet" 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-primary/50"
            }`}
          >
            <Wallet className={`w-6 h-6 ${paymentMethod === "wallet" ? "text-primary" : "text-muted-foreground"}`} />
            <span className="text-sm font-medium">E-Wallet</span>
          </button>

          <button
            onClick={() => setPaymentMethod("qr")}
            className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
              paymentMethod === "qr" 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-primary/50"
            }`}
          >
            <QrCode className={`w-6 h-6 ${paymentMethod === "qr" ? "text-primary" : "text-muted-foreground"}`} />
            <span className="text-sm font-medium">QR Code</span>
          </button>
        </div>

        <form onSubmit={handlePayment} className="space-y-4">
          {paymentMethod === "card" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="cardNumber">หมายเลขบัตร</Label>
                <Input 
                  id="cardNumber" 
                  placeholder="1234 5678 9012 3456"
                  className="text-lg tracking-wider"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiry">วันหมดอายุ</Label>
                  <Input id="expiry" placeholder="MM/YY" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cvv">CVV</Label>
                  <Input id="cvv" placeholder="123" maxLength={3} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">ชื่อบนบัตร</Label>
                <Input id="name" placeholder="JOHN DOE" />
              </div>
            </>
          )}

          {paymentMethod === "wallet" && (
            <div className="space-y-4 py-8 text-center">
              <p className="text-muted-foreground">เลือก E-Wallet ที่ต้องการใช้งาน</p>
              <div className="grid grid-cols-3 gap-4">
                {["TrueMoney", "Rabbit LINE Pay", "ShopeePay"].map((wallet) => (
                  <button
                    key={wallet}
                    type="button"
                    className="p-4 border-2 border-border rounded-lg hover:border-primary transition-all"
                  >
                    <span className="text-sm font-medium">{wallet}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {paymentMethod === "qr" && (
            <div className="space-y-4 py-8 text-center">
              <div className="w-48 h-48 mx-auto bg-muted rounded-lg flex items-center justify-center">
                <QrCode className="w-32 h-32 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">สแกน QR Code เพื่อชำระเงิน</p>
            </div>
          )}

          <Button type="submit" variant="gradient" size="lg" className="w-full mt-6">
            ชำระเงิน ฿1,299
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default PaymentForm;
