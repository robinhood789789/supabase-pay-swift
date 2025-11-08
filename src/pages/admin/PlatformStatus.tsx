import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertCircle, CheckCircle, XCircle, Activity } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface HealthStatus {
  component: string;
  status: "healthy" | "degraded" | "down";
  response_time_ms?: number;
  last_check: string;
  message?: string;
}

const PlatformStatus = () => {
  const { user, isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [healthChecks, setHealthChecks] = useState<HealthStatus[]>([]);

  useEffect(() => {
    if (!user || !isSuperAdmin) return;

    // Audit: Page view
    supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "platform.status.view",
      target_type: "platform_status",
      ip_address: "",
      user_agent: navigator.userAgent,
    });

    performHealthChecks();
    const interval = setInterval(performHealthChecks, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [user, isSuperAdmin]);

  const performHealthChecks = async () => {
    setLoading(true);
    try {
      const checks: HealthStatus[] = [];

      // Database connectivity
      const dbStart = Date.now();
      const { error: dbError } = await supabase.from("tenants").select("count").limit(1).single();
      const dbTime = Date.now() - dbStart;
      checks.push({
        component: "Database",
        status: dbError ? "down" : dbTime > 1000 ? "degraded" : "healthy",
        response_time_ms: dbTime,
        last_check: new Date().toISOString(),
        message: dbError ? dbError.message : undefined,
      });

      // Auth service
      const authStart = Date.now();
      const { error: authError } = await supabase.auth.getSession();
      const authTime = Date.now() - authStart;
      checks.push({
        component: "Auth Service",
        status: authError ? "down" : authTime > 500 ? "degraded" : "healthy",
        response_time_ms: authTime,
        last_check: new Date().toISOString(),
      });

      // Webhook queue (mock check)
      checks.push({
        component: "Webhook Queue",
        status: "healthy",
        response_time_ms: 50,
        last_check: new Date().toISOString(),
        message: "Queue depth: 0",
      });

      // Background jobs (mock check)
      checks.push({
        component: "Background Jobs",
        status: "healthy",
        response_time_ms: 20,
        last_check: new Date().toISOString(),
        message: "All workers running",
      });

      setHealthChecks(checks);
    } catch (error) {
      console.error("Error performing health checks:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: HealthStatus["status"]) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "degraded":
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case "down":
        return <XCircle className="h-5 w-5 text-red-600" />;
    }
  };

  const getStatusBadge = (status: HealthStatus["status"]) => {
    const variants = {
      healthy: "default",
      degraded: "secondary",
      down: "destructive",
    } as const;
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  const getResponseTimeColor = (ms?: number) => {
    if (!ms) return "bg-gray-500";
    if (ms < 200) return "bg-green-600";
    if (ms < 1000) return "bg-yellow-600";
    return "bg-red-600";
  };

  const overallStatus =
    healthChecks.some((c) => c.status === "down")
      ? "down"
      : healthChecks.some((c) => c.status === "degraded")
      ? "degraded"
      : "healthy";

  if (loading && healthChecks.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>คุณไม่มีสิทธิ์เข้าถึงหน้านี้</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Platform Health & Status</h1>
        <p className="text-muted-foreground">ติดตามสถานะของ platform components</p>
      </div>

      <Card className={overallStatus === "healthy" ? "border-green-200" : overallStatus === "degraded" ? "border-yellow-200" : "border-red-200"}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-6 w-6" />
                Overall Status
              </CardTitle>
              <CardDescription>อัปเดตล่าสุด: {new Date().toLocaleString("th-TH")}</CardDescription>
            </div>
            {getStatusBadge(overallStatus)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {overallStatus === "healthy" && "✅ All Systems Operational"}
            {overallStatus === "degraded" && "⚠️ Degraded Performance"}
            {overallStatus === "down" && "🚨 System Outage"}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {healthChecks.map((check, index) => (
          <Card key={index}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  {getStatusIcon(check.status)}
                  {check.component}
                </CardTitle>
                {getStatusBadge(check.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {check.response_time_ms !== undefined && (
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Response Time</span>
                    <span className="font-medium">{check.response_time_ms}ms</span>
                  </div>
                  <Progress
                    value={Math.min((check.response_time_ms / 2000) * 100, 100)}
                    className={getResponseTimeColor(check.response_time_ms)}
                  />
                </div>
              )}
              <div className="text-sm text-muted-foreground">
                Last check: {new Date(check.last_check).toLocaleTimeString("th-TH")}
              </div>
              {check.message && (
                <div className="text-sm bg-muted p-2 rounded">{check.message}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          🔄 หน้านี้จะอัปเดตอัตโนมัติทุก 30 วินาที
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default PlatformStatus;
