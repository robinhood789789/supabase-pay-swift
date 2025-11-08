import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

const PayLinkSuccess = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary">
            <CheckCircle2 className="w-8 h-8" />
            <CardTitle className="text-2xl">Payment Successful!</CardTitle>
          </div>
          <CardDescription>
            Your payment has been processed successfully.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Thank you for your payment. You should receive a confirmation shortly.
          </p>
          <Button onClick={() => navigate("/")} className="w-full">
            Done
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PayLinkSuccess;
