export function setupSecurityHeaders() {
  // Add meta tags for security headers
  const metaTags = [
    // Content Security Policy
    {
      httpEquiv: 'Content-Security-Policy',
      content: [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https: blob:",
        "font-src 'self' data:",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
        "frame-ancestors 'self' https://payment.opn.ooo https://api.stripe.com https://js.stripe.com",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '),
    },
    // Strict Transport Security
    {
      httpEquiv: 'Strict-Transport-Security',
      content: 'max-age=31536000; includeSubDomains',
    },
    // X-Content-Type-Options
    {
      httpEquiv: 'X-Content-Type-Options',
      content: 'nosniff',
    },
    // X-Frame-Options
    {
      httpEquiv: 'X-Frame-Options',
      content: 'SAMEORIGIN',
    },
    // Referrer Policy
    {
      httpEquiv: 'Referrer-Policy',
      content: 'strict-origin-when-cross-origin',
    },
    // Permissions Policy
    {
      httpEquiv: 'Permissions-Policy',
      content: 'camera=(), microphone=(), geolocation=()',
    },
  ];

  metaTags.forEach(({ httpEquiv, content }) => {
    const existing = document.querySelector(`meta[http-equiv="${httpEquiv}"]`);
    if (existing) {
      existing.setAttribute('content', content);
    } else {
      const meta = document.createElement('meta');
      meta.httpEquiv = httpEquiv;
      meta.content = content;
      document.head.appendChild(meta);
    }
  });
}
