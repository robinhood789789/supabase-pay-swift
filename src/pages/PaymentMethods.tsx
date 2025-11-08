import DashboardLayout from "@/components/DashboardLayout";
import PaymentMethodsConfig from "@/components/settings/PaymentMethodsConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function PaymentMethods() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Payment Methods</h1>
          <p className="text-muted-foreground">
            Configure payment providers and available payment methods
          </p>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Provider Configuration Required</AlertTitle>
          <AlertDescription>
            Make sure to configure your payment provider API keys in the Lovable Cloud
            dashboard under Secrets before enabling payment methods.
          </AlertDescription>
        </Alert>

        <PaymentMethodsConfig />

        <Card>
          <CardHeader>
            <CardTitle>Required Environment Variables</CardTitle>
            <CardDescription>
              Configure these secrets in your Lovable Cloud dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 font-mono text-sm">
              <div className="p-2 bg-muted rounded">STRIPE_SECRET_KEY</div>
              <div className="p-2 bg-muted rounded">STRIPE_WEBHOOK_SECRET</div>
              <div className="p-2 bg-muted rounded">OPN_SECRET_KEY</div>
              <div className="p-2 bg-muted rounded">TWOC2P_SECRET_KEY</div>
              <div className="p-2 bg-muted rounded">TWOC2P_MERCHANT_ID</div>
              <div className="p-2 bg-muted rounded">KBANK_SECRET_KEY</div>
              <div className="p-2 bg-muted rounded">KBANK_MERCHANT_ID</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
