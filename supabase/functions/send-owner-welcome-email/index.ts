import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const resendApiKey = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface OwnerWelcomeEmailRequest {
  tenantName: string;
  email: string;
  temporaryPassword: string;
}

const createEmailHTML = (tenantName: string, email: string, temporaryPassword: string, loginUrl: string) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${tenantName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; background-color: #f6f9fc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f6f9fc; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; padding: 40px 20px;">
          
          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <h1 style="color: #1a1a1a; font-size: 28px; font-weight: bold; margin: 0;">🎉 Welcome to Your Payment Gateway</h1>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 0 20px;">
              <p style="color: #333333; font-size: 16px; line-height: 24px; margin: 16px 0;">
                Your owner account for <strong>${tenantName}</strong> has been successfully created!
              </p>
              
              <!-- Info Box -->
              <table width="100%" cellpadding="20" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef; margin: 24px 0;">
                <tr>
                  <td>
                    <p style="color: #6c757d; font-size: 13px; font-weight: 600; text-transform: uppercase; margin: 12px 0 4px; letter-spacing: 0.5px;">Tenant Name:</p>
                    <p style="color: #212529; font-size: 16px; font-weight: 500; margin: 0 0 16px;">${tenantName}</p>
                    
                    <p style="color: #6c757d; font-size: 13px; font-weight: 600; text-transform: uppercase; margin: 12px 0 4px; letter-spacing: 0.5px;">Email:</p>
                    <p style="color: #212529; font-size: 16px; font-weight: 500; margin: 0 0 16px;">${email}</p>
                    
                    <p style="color: #6c757d; font-size: 13px; font-weight: 600; text-transform: uppercase; margin: 12px 0 4px; letter-spacing: 0.5px;">Temporary Password:</p>
                    <div style="background-color: #fff3cd; border: 2px solid #ffc107; border-radius: 6px; padding: 16px; margin: 0 0 16px;">
                      <p style="color: #856404; font-size: 18px; font-weight: bold; margin: 0; font-family: monospace; text-align: center; letter-spacing: 2px;">${temporaryPassword}</p>
                    </div>
                  </td>
                </tr>
              </table>
              
              <p style="color: #333333; font-size: 16px; line-height: 24px; margin: 16px 0;">
                Please save this temporary password securely. You'll need it to log in for the first time.
              </p>
              
              <!-- Login Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}" style="background-color: #0066ff; border-radius: 6px; color: #ffffff; display: inline-block; font-size: 16px; font-weight: bold; text-align: center; text-decoration: none; padding: 14px 24px;">Log In to Your Account</a>
                  </td>
                </tr>
              </table>
              
              <!-- Security Warning -->
              <div style="margin: 24px 0;">
                <p style="color: #dc3545; font-size: 14px; line-height: 20px; margin: 8px 0;">
                  ⚠️ <strong>Important Security Notice:</strong>
                </p>
                <p style="color: #dc3545; font-size: 14px; line-height: 20px; margin: 8px 0;">
                  • Change your password immediately after your first login<br/>
                  • This temporary password will not be sent again<br/>
                  • Enable two-factor authentication for added security<br/>
                  • Never share your password with anyone
                </p>
              </div>
              
              <!-- Features Box -->
              <table width="100%" cellpadding="20" cellspacing="0" style="background-color: #f8f9fa; border-left: 4px solid #0066ff; border-radius: 4px; margin: 24px 0;">
                <tr>
                  <td>
                    <p style="color: #1a1a1a; font-size: 16px; font-weight: bold; margin: 0 0 12px;">What you can do as an Owner:</p>
                    <p style="color: #495057; font-size: 14px; line-height: 24px; margin: 6px 0;">✓ Manage payment methods and configurations</p>
                    <p style="color: #495057; font-size: 14px; line-height: 24px; margin: 6px 0;">✓ View all transactions and settlements</p>
                    <p style="color: #495057; font-size: 14px; line-height: 24px; margin: 6px 0;">✓ Add and manage team members</p>
                    <p style="color: #495057; font-size: 14px; line-height: 24px; margin: 6px 0;">✓ Configure webhooks and API keys</p>
                    <p style="color: #495057; font-size: 14px; line-height: 24px; margin: 6px 0;">✓ Access detailed reports and analytics</p>
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 32px 20px 16px;">
              <p style="color: #6c757d; font-size: 14px; line-height: 20px; margin: 0; text-align: center;">
                If you have any questions or need assistance, please don't hesitate to contact our support team.
              </p>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 8px 20px 0;">
              <p style="color: #adb5bd; font-size: 12px; text-align: center; margin: 0;">
                © ${new Date().getFullYear()} Payment Gateway Platform. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenantName, email, temporaryPassword }: OwnerWelcomeEmailRequest = await req.json();

    console.log("Sending owner welcome email to:", email);

    // Get the app URL from environment or use a default
    const appUrl = Deno.env.get("PUBLIC_APP_URL") || "http://localhost:5173";
    const loginUrl = `${appUrl}/auth/sign-in`;

    // Create HTML email
    const html = createEmailHTML(tenantName, email, temporaryPassword, loginUrl);

    // Send email using Resend API directly
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Payment Gateway <onboarding@resend.dev>',
        to: [email],
        subject: `Welcome to ${tenantName} - Your Owner Account is Ready`,
        html: html,
      }),
    });

    const emailData = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Error sending email:", emailData);
      throw new Error(`Failed to send email: ${JSON.stringify(emailData)}`);
    }

    console.log("Email sent successfully:", emailData);

    return new Response(JSON.stringify({ success: true, data: emailData }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-owner-welcome-email function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
