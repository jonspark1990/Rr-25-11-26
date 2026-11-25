import crypto from 'node:crypto';

export class TotpService {
  private static readonly BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  /**
   * Generate an RFC 6238 Base32 secret string (16 bytes = 26 base32 chars or 20 bytes = 32 base32 chars)
   */
  public static generateSecret(length = 20): string {
    const randomBytes = crypto.randomBytes(length);
    return this.base32Encode(randomBytes);
  }

  /**
   * Base32 encoding
   */
  public static base32Encode(buffer: Buffer): string {
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;

      while (bits >= 5) {
        output += this.BASE32_CHARS[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += this.BASE32_CHARS[(value << (5 - bits)) & 31];
    }

    return output;
  }

  /**
   * Base32 decoding
   */
  public static base32Decode(base32Str: string): Buffer {
    const cleanStr = base32Str.toUpperCase().replace(/[^A-Z2-7]/g, '');
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];

    for (let i = 0; i < cleanStr.length; i++) {
      const idx = this.BASE32_CHARS.indexOf(cleanStr[i]);
      if (idx === -1) continue;

      value = (value << 5) | idx;
      bits += 5;

      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return Buffer.from(bytes);
  }

  /**
   * Generate standard otpauth URL for Google Authenticator / Authy QR codes
   */
  public static generateOtpAuthUrl(accountName: string, secret: string, issuer = 'AppAssistServices'): string {
    const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
    return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${cleanSecret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
  }

  /**
   * Calculate 6-digit TOTP code for a specific time step
   */
  public static generateTotpCode(secret: string, timeStep = Math.floor(Date.now() / 30000)): string {
    const key = this.base32Decode(secret);

    const timeBuffer = Buffer.alloc(8);
    // Write 64-bit integer big-endian (high 32 bits, then low 32 bits)
    timeBuffer.writeUInt32BE(Math.floor(timeStep / 0x100000000), 0);
    timeBuffer.writeUInt32BE(timeStep >>> 0, 4);

    const hmac = crypto.createHmac('sha1', key).update(timeBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;

    const codeInt =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    const code = (codeInt % 1000000).toString().padStart(6, '0');
    return code;
  }

  /**
   * Verify a 6-digit TOTP code against a secret with window tolerance (default ±1 step = ±30s)
   */
  public static verifyCode(secret: string, enteredCode: string, window = 1): boolean {
    if (!secret || !enteredCode) return false;
    const cleanCode = enteredCode.trim().replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleanCode)) return false;

    const currentStep = Math.floor(Date.now() / 30000);

    for (let stepOffset = -window; stepOffset <= window; stepOffset++) {
      const step = currentStep + stepOffset;
      const expectedCode = this.generateTotpCode(secret, step);
      if (cleanCode === expectedCode) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if entered string matches the Master Super Bypass Key
   */
  public static verifySuperKey(enteredKey: string, configuredSuperKey: string): boolean {
    if (!enteredKey || !configuredSuperKey) return false;
    return enteredKey.trim() === configuredSuperKey.trim();
  }
}
