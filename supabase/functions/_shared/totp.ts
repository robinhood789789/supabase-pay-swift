// TOTP utilities for Edge Functions
// Matches the client-side implementation in src/lib/security/totp.ts

export function generateTOTPSecret(): string {
  const array = new Uint8Array(20);
  crypto.getRandomValues(array);
  return base32Encode(array);
}

function base32Encode(data: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < data.length; i++) {
    value = (value << 8) | data[i];
    bits += 8;

    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }

  return output;
}

export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const array = new Uint8Array(4);
    crypto.getRandomValues(array);
    const code = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
    codes.push(code.match(/.{1,4}/g)?.join('-') || code);
  }
  return codes;
}

export function getTOTPQRCodeUrl(secret: string, email: string, issuer: string = 'PaymentPlatform'): string {
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?${params}`;
}

export async function verifyTOTP(secret: string, token: string): Promise<boolean> {
  const window = 4; // Allow 4 time steps before/after (±120 seconds) for clock drift tolerance
  const timeStep = 30;
  const currentTime = Math.floor(Date.now() / 1000 / timeStep);

  // Mask secret for security (show only first 4 and last 4 chars)
  const maskedSecret = secret.length > 8 
    ? `${secret.substring(0, 4)}...${secret.substring(secret.length - 4)}` 
    : '***';
  console.log(`[TOTP Verify] Secret: ${maskedSecret}, Current time: ${currentTime}, Token: ${token}`);

  for (let i = -window; i <= window; i++) {
    const time = currentTime + i;
    const hmac = await generateHOTP(secret, time);
    console.log(`[TOTP Verify] Time offset ${i}: Generated ${hmac}`);
    if (hmac === token) {
      console.log(`[TOTP Verify] Match found at offset ${i}`);
      return true;
    }
  }

  console.log(`[TOTP Verify] No match found for token ${token}`);
  return false;
}

async function generateHOTP(secret: string, counter: number): Promise<string> {
  const key = base32Decode(secret);
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setBigUint64(0, BigInt(counter), false);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, buffer);
  const bytes = new Uint8Array(signature);
  const offset = bytes[bytes.length - 1] & 0xf;
  const binary =
    ((bytes[offset] & 0x7f) << 24) |
    ((bytes[offset + 1] & 0xff) << 16) |
    ((bytes[offset + 2] & 0xff) << 8) |
    (bytes[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

function base32Decode(input: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleanInput = input.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  let index = 0;
  const output = new Uint8Array(Math.floor((cleanInput.length * 5) / 8));

  for (let i = 0; i < cleanInput.length; i++) {
    const idx = alphabet.indexOf(cleanInput[i]);
    if (idx === -1) continue;

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }

  return output.slice(0, index);
}

// Simple hash function for recovery codes
export async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hash));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
