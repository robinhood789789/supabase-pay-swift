import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, Clock, CreditCard, Smartphone, QrCode as QrCodeIcon } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

interface PaymentLink {
  slug: string;
  amount: number;
  currency: string;
  reference: string | null;
  status: string;
  expires_at: string | null;
  isExpired: boolean;
  usageLimitReached: boolean;
  canPay: boolean;
}

const PayLink = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { t, formatCurrency } = useI18n();
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string>("");
  const [checkoutData, setCheckoutData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch payment link details
  const { data: link, isLoading, error } = useQuery<PaymentLink>({
    queryKey: ["payment-link", slug],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        `payment-links-get/${slug}`
      );
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // Countdown timer
  useEffect(() => {
    if (!link?.expires_at) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const expiry = new Date(link.expires_at!).getTime();
      const distance = expiry - now;

      if (distance < 0) {
        setCountdown("Expired");
        clearInterval(timer);
      } else {
        const hours = Math.floor(distance / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        setCountdown(`${hours}h ${minutes}m ${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [link?.expires_at]);

  const handleMethodSelect = (method: string) => {
    setSelectedMethod(method);
  };

  const handleCheckout = async () => {
    if (!selectedMethod) {
      toast.error(t('errors.validation'));
      return;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        `payment-links-checkout/${slug}/checkout`,
        {
          body: { methodTypes: [selectedMethod] },
        }
      );

      if (error) throw error;

      setCheckoutData(data);

      // If there's a redirect URL (for cards), redirect
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error(t('errors.generic'));
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex-1 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32 mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        </div>
        <footer className="p-4 border-t border-border flex justify-center">
          <LocaleSwitcher />
        </footer>
      </div>
    );
  }

  if (error || !link) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex-1 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="w-6 h-6" />
                <CardTitle>{t('payLink.notFound')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {t('errors.notFound')}
              </p>
              <Button onClick={() => navigate("/")} className="mt-4">
                {t('payLink.goHome')}
              </Button>
            </CardContent>
          </Card>
        </div>
        <footer className="p-4 border-t border-border flex justify-center">
          <LocaleSwitcher />
        </footer>
      </div>
    );
  }

  if (!link.canPay) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex-1 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="w-6 h-6" />
                <CardTitle>{t('payLink.unavailable')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {link.isExpired
                  ? t('payLink.expired')
                  : link.usageLimitReached
                  ? t('payLink.usageLimit')
                  : t('payLink.inactive')}
              </p>
            </CardContent>
          </Card>
        </div>
        <footer className="p-4 border-t border-border flex justify-center">
          <LocaleSwitcher />
        </footer>
      </div>
    );
  }

  // Success screen after QR payment
  if (checkoutData && checkoutData.qrImageUrl) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>{t('payLink.scanQr')}</CardTitle>
              <CardDescription>
                {t('common.amount')}: {formatCurrency(link.amount, link.currency.toUpperCase())}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center">
                <img
                  src={checkoutData.qrImageUrl}
                  alt="Payment QR Code"
                  className="w-64 h-64 border rounded"
                />
              </div>
              {checkoutData.expiresAt && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>{t('payLink.expiresIn')} {countdown}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <footer className="p-4 border-t border-border flex justify-center">
          <LocaleSwitcher />
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t('payLink.title')}</CardTitle>
            <CardDescription>
              {link.reference && <div className="text-xs mt-1">Ref: {link.reference}</div>}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Amount */}
            <div className="text-center">
              <div className="text-4xl font-bold">
                {formatCurrency(link.amount, link.currency.toUpperCase())}
              </div>
              {link.expires_at && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-2">
                  <Clock className="w-4 h-4" />
                  <span>{t('payLink.expiresIn')} {countdown}</span>
                </div>
              )}
            </div>

            {/* Payment Methods */}
            <div className="space-y-3">
              <p className="text-sm font-medium">{t('payLink.selectMethod')}</p>
              <div className="grid gap-2">
                <Button
                  variant={selectedMethod === "card" ? "default" : "outline"}
                  className="justify-start"
                  onClick={() => handleMethodSelect("card")}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  {t('payments.card')}
                </Button>
                <Button
                  variant={selectedMethod === "promptpay" ? "default" : "outline"}
                  className="justify-start"
                  onClick={() => handleMethodSelect("promptpay")}
                >
                  <QrCodeIcon className="w-4 h-4 mr-2" />
                  {t('payments.promptpay')}
                </Button>
                <Button
                  variant={selectedMethod === "mobile_banking" ? "default" : "outline"}
                  className="justify-start"
                  onClick={() => handleMethodSelect("mobile_banking")}
                >
                  <Smartphone className="w-4 h-4 mr-2" />
                  {t('payments.mobileBanking')}
                </Button>
              </div>
            </div>

            {/* Pay Button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleCheckout}
              disabled={!selectedMethod || isProcessing}
            >
              {isProcessing ? t('payLink.processing') : t('payLink.continuePayment')}
            </Button>
          </CardContent>
        </Card>
      </div>
      <footer className="p-4 border-t border-border flex justify-center">
        <LocaleSwitcher />
      </footer>
    </div>
  );
};

export default PayLink;
