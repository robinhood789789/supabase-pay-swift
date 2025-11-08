import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Crown, Users, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PyramidAuthority() {
  const roles = [
    {
      level: "top",
      icon: Crown,
      title: "Super Admin",
      subtitle: "Platform Operator",
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950/20",
      borderColor: "border-purple-200 dark:border-purple-900",
      responsibilities: [
        "Provision new merchants and tenants",
        "Create Owner accounts with temporary passwords",
        "Enforce platform-wide security policies",
        "Manage platform fees and feature flags",
        "View cross-tenant analytics and audit logs",
        "Lock/unlock tenants and users",
        "Access all data with proper audit trail",
      ],
      restrictions: [
        "Cannot bypass MFA requirements",
        "All actions are logged with IP/device",
        "Read-only impersonation only",
      ],
      mfaRequired: true,
    },
    {
      level: "mid",
      icon: Shield,
      title: "Owner",
      subtitle: "Tenant Administrator",
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
      borderColor: "border-blue-200 dark:border-blue-900",
      responsibilities: [
        "Full control within their tenant only",
        "Invite and manage Admin users",
        "Assign role templates and permissions",
        "Configure tenant security policies",
        "Set up guardrails and approval rules",
        "Review audit logs for their tenant",
        "Approve sensitive actions (dual control)",
      ],
      restrictions: [
        "Cannot access other tenants' data",
        "Cannot modify platform-level settings",
        "2FA enforced (can be required by platform)",
      ],
      mfaRequired: true,
    },
    {
      level: "base",
      icon: Users,
      title: "Admin",
      subtitle: "Staff Member",
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950/20",
      borderColor: "border-green-200 dark:border-green-900",
      responsibilities: [
        "Limited access as defined by Owner",
        "Perform daily operations (payments, refunds)",
        "View assigned reports and data",
        "Create payment links and manage customers",
        "Submit approval requests for sensitive actions",
      ],
      restrictions: [
        "Cannot modify security policies",
        "Cannot invite or remove users",
        "Cannot approve their own requests",
        "Subject to guardrails and rate limits",
      ],
      mfaRequired: "conditional",
    },
  ];

  const securityFlow = [
    {
      step: 1,
      title: "Authentication",
      items: [
        "Email/password login",
        "Optional 2FA (Owner/Admin)",
        "Forced 2FA (Super Admin always)",
        "Session creation with device fingerprint",
      ],
    },
    {
      step: 2,
      title: "Authorization",
      items: [
        "Role-based permissions checked",
        "Tenant isolation enforced (RLS)",
        "Permission templates applied",
        "Action-level granular controls",
      ],
    },
    {
      step: 3,
      title: "Guardrails",
      items: [
        "Amount thresholds checked",
        "Time-based restrictions applied",
        "Rate limits enforced",
        "Auto-block if rule matched",
      ],
    },
    {
      step: 4,
      title: "Approvals",
      items: [
        "Dual control for sensitive actions",
        "Step-up MFA verification",
        "Approval workflow initiated",
        "Action executed on approval",
      ],
    },
    {
      step: 5,
      title: "Audit",
      items: [
        "Before/after state captured",
        "IP address and device logged",
        "Request ID for correlation",
        "WORM (Write Once Read Many)",
      ],
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Pyramid Authority Model
          </h1>
          <p className="text-muted-foreground">
            Understanding the three-tier security and permission hierarchy
          </p>
        </div>

        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Core Principle:</strong> The Pyramid Authority Model ensures clear separation of duties, 
            prevents privilege escalation, and maintains an audit trail for all sensitive actions. 
            Each level has specific powers and limitations to protect the platform and customer data.
          </AlertDescription>
        </Alert>

        <div className="grid gap-6">
          {roles.map((role, index) => {
            const Icon = role.icon;
            return (
              <Card key={role.level} className={`${role.borderColor} border-2`}>
                <CardHeader className={role.bgColor}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg bg-background`}>
                        <Icon className={`h-8 w-8 ${role.color}`} />
                      </div>
                      <div>
                        <CardTitle className={`text-2xl ${role.color}`}>
                          {role.title}
                        </CardTitle>
                        <CardDescription className="text-lg">
                          {role.subtitle}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline" className={role.color}>
                        Level {index + 1}
                      </Badge>
                      {role.mfaRequired === true && (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                          2FA Required
                        </Badge>
                      )}
                      {role.mfaRequired === "conditional" && (
                        <Badge variant="outline">
                          2FA Conditional
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      Responsibilities & Powers
                    </h4>
                    <ul className="space-y-2">
                      {role.responsibilities.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-green-600 mt-0.5">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-600" />
                      Restrictions & Limits
                    </h4>
                    <ul className="space-y-2">
                      {role.restrictions.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-red-600 mt-0.5">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Security & Compliance Flow</CardTitle>
            <CardDescription>
              How requests are processed through multiple security layers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {securityFlow.map((phase, index) => (
                <div key={phase.step}>
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold">
                        {phase.step}
                      </div>
                      {index < securityFlow.length - 1 && (
                        <div className="w-0.5 h-16 bg-border mt-2" />
                      )}
                    </div>
                    <div className="flex-1 pb-8">
                      <h4 className="font-semibold text-lg mb-2">{phase.title}</h4>
                      <ul className="space-y-1">
                        {phase.items.map((item, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <ArrowRight className="h-3 w-3" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500">
          <CardHeader className="bg-amber-50 dark:bg-amber-950/20">
            <CardTitle className="text-amber-900 dark:text-amber-100">
              Best Practices
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-6">
            <div className="space-y-2">
              <h4 className="font-semibold">For Super Admins:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Always use 2FA - it's mandatory for platform security</li>
                <li>Review platform audit logs regularly</li>
                <li>Use read-only impersonation for troubleshooting</li>
                <li>Set appropriate platform defaults for new tenants</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold">For Owners:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Enforce 2FA for all Admins handling sensitive operations</li>
                <li>Review Admin permissions and role templates regularly</li>
                <li>Set up guardrails for high-risk actions (refunds, exports)</li>
                <li>Enable dual-control approvals for financial operations</li>
                <li>Monitor activity logs and configure alerts</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold">For Admins:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Enable 2FA even if not required - protect your account</li>
                <li>Never share credentials or 2FA codes</li>
                <li>Review your activity panel to track daily limits</li>
                <li>Report suspicious activity immediately</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
