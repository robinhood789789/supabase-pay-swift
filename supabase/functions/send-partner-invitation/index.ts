import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const resendApiKey = Deno.env.get('RESEND_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InvitationRequest {
  email: string;
  display_name: string;
  magic_link: string;
  temp_password?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { email, display_name, magic_link, temp_password }: InvitationRequest = await req.json();

    console.log('[send-partner-invitation] Sending invitation to:', email);

    // สร้างอีเมลเชิญ (Thai)
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .credentials { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 0.9em; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 ยินดีต้อนรับสู่พอร์ทัลพาร์ทเนอร์</h1>
            </div>
            <div class="content">
              <p>สวัสดีคุณ <strong>${display_name}</strong>,</p>
              
              <p>คุณได้รับเชิญให้เข้าร่วมระบบพอร์ทัลพาร์ทเนอร์ (Shareholder Management)</p>
              
              <div class="credentials">
                <h3>📧 ข้อมูลการเข้าสู่ระบบของคุณ</h3>
                <p><strong>อีเมล (User ID):</strong> ${email}</p>
                ${temp_password ? `<p><strong>รหัสผ่านชั่วคราว:</strong> <code style="background: #f0f0f0; padding: 5px 10px; border-radius: 3px;">${temp_password}</code></p>` : ''}
              </div>

              <div class="warning">
                <strong>⚠️ สำคัญ:</strong>
                <ul>
                  <li>คุณจะต้องเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งแรก</li>
                  <li>คุณจะต้องเปิดใช้งาน Two-Factor Authentication (2FA) ด้วย Google Authenticator</li>
                  <li>ลิงก์เชิญนี้จะหมดอายุภายใน 72 ชั่วโมง</li>
                </ul>
              </div>

              <div style="text-align: center;">
                <a href="${magic_link}" class="button">🔐 เข้าสู่ระบบทันที</a>
              </div>

              <p style="margin-top: 30px;">หากปุ่มด้านบนไม่ทำงาน คุณสามารถคัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:</p>
              <p style="word-break: break-all; background: white; padding: 15px; border-radius: 5px; font-size: 0.9em;">
                ${magic_link}
              </p>

              <div class="footer">
                <p>หากคุณไม่ได้ขอเข้าร่วมระบบนี้ กรุณาเพิกเฉยต่ออีเมลนี้</p>
                <p style="margin-top: 20px;">© ${new Date().getFullYear()} Payment Platform - Shareholder Portal</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Shareholder Portal <onboarding@resend.dev>',
        to: [email],
        subject: '🎉 เชิญใช้งานพอร์ทัลพาร์ทเนอร์',
        html: emailHtml,
      }),
    });

    const emailData = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error('[send-partner-invitation] Email error:', emailData);
      throw new Error(`Failed to send email: ${JSON.stringify(emailData)}`);
    }

    console.log('[send-partner-invitation] Email sent successfully to:', email);

    // Log audit
    await supabase.from('audit_logs').insert({
      action: 'partner.invitation.sent',
      actor_user_id: user.id,
      target: email,
      after: { email, display_name },
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Invitation sent successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[send-partner-invitation] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send invitation' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
