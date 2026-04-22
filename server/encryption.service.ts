import crypto from 'crypto';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

// Cache the derived encryption key to avoid expensive scrypt calls on every decrypt
let cachedEncryptionKey: Buffer | null = null;
let cachedDefaultEncryptionKey: Buffer | null = null;
const cachedDerivedKeysBySecret = new Map<string, Buffer>();

let didLogKeyFingerprint = false;

function normalizeEnvSecret(raw: string): string {
  // Render env vars sometimes get pasted with quotes or trailing whitespace.
  // Normalizing prevents accidental key mismatches between local and hosted.
  const trimmed = String(raw ?? '').trim();
  const unquoted = trimmed.replace(/^['"]/, '').replace(/['"]$/, '');
  return unquoted;
}

function getDerivedKeyFromSecret(secret: string): Buffer {
  const normalized = normalizeEnvSecret(secret);
  const existing = cachedDerivedKeysBySecret.get(normalized);
  if (existing) return existing;
  const derived = crypto.scryptSync(normalized, 'salt', 32);
  cachedDerivedKeysBySecret.set(normalized, derived);
  return derived;
}

function getFallbackEncryptionSecrets(): string[] {
  const raw = String(process.env.ENCRYPTION_KEY_FALLBACKS ?? '').trim();
  if (!raw) return [];
  const parts = raw
    .split(',')
    .map((p) => normalizeEnvSecret(p))
    .map((p) => p.trim())
    .filter(Boolean);
  return Array.from(new Set(parts));
}

function getFallbackEncryptionKeys(primarySecret: string): Buffer[] {
  const fallbacks = getFallbackEncryptionSecrets().filter((s) => s && s !== primarySecret);
  return fallbacks.map((s) => getDerivedKeyFromSecret(s));
}

function toBase64Url(base64: string): string {
  // Convert standard base64 -> base64url (RFC 4648 §5)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(base64Url: string): string {
  // Convert base64url -> standard base64, adding padding
  const b64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (b64.length % 4)) % 4;
  return b64 + '='.repeat(padLen);
}

function normalizeBase64OrUrl(str: string): string {
  // If it already looks like standard base64, keep as-is.
  // If it contains base64url characters, convert.
  if (str.includes('-') || str.includes('_')) return fromBase64Url(str);
  // Some base64url generators keep '+'/'/' but strip '=', so ensure padding.
  const padLen = (4 - (str.length % 4)) % 4;
  return str + '='.repeat(padLen);
}

// Get encryption key from environment or generate a strong one
function getEncryptionKey(): Buffer {
  // Return cached key if already derived
  if (cachedEncryptionKey) {
    return cachedEncryptionKey;
  }
  
  const keyRaw = process.env.ENCRYPTION_KEY;
  const key = keyRaw ? normalizeEnvSecret(keyRaw) : '';
  if (!key) {
    const isHostedProd =
      process.env.NODE_ENV === 'production' ||
      !!process.env.RENDER ||
      !!process.env.RENDER_SERVICE_ID ||
      !!process.env.RENDER_EXTERNAL_URL;

    if (isHostedProd) {
      throw new Error(
        'ENCRYPTION_KEY is missing. Set it in your environment (Render dashboard → Environment) to decrypt existing data and avoid writing insecure encrypted rows.'
      );
    }

    console.warn('ENCRYPTION_KEY not set in environment. Using default (NOT SECURE FOR PRODUCTION)');
    cachedEncryptionKey = crypto.scryptSync('default-key-change-this', 'salt', 32);
    return cachedEncryptionKey;
  }

  if (!didLogKeyFingerprint) {
    didLogKeyFingerprint = true;
    const shouldLogFingerprint = process.env.LOG_ENCRYPTION_KEY_FINGERPRINT === 'true' || process.env.NODE_ENV !== 'production';
    if (shouldLogFingerprint) {
      const fp = crypto.createHash('sha256').update(key).digest('hex').slice(0, 10);
      const changedByNormalization = keyRaw != null && key !== keyRaw;
      console.log(`[encryption] ENCRYPTION_KEY fingerprint=${fp}${changedByNormalization ? ' (normalized)' : ''}`);
    }
  }

  // Derive a 256-bit key from the provided key (expensive operation - cache it!)
  cachedEncryptionKey = getDerivedKeyFromSecret(key);
  return cachedEncryptionKey;
}

function getDefaultEncryptionKey(): Buffer {
  if (cachedDefaultEncryptionKey) {
    return cachedDefaultEncryptionKey;
  }
  cachedDefaultEncryptionKey = crypto.scryptSync('default-key-change-this', 'salt', 32);
  return cachedDefaultEncryptionKey;
}

/**
 * Encrypts sensitive data using AES-256-GCM
 * @param text - Plain text to encrypt
 * @returns Encrypted string (base64 encoded)
 */
export function encrypt(text: string | number): string {
  if (!text && text !== 0) return String(text || '');
  
  const textStr = String(text);
  
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = getEncryptionKey();
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(textStr, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    
    // Combine salt + iv + tag + encrypted data
    const combined = Buffer.concat([salt, iv, tag, encrypted]);
    return combined.toString('base64');
  } catch (error) {
    console.error('Encryption error:', error);
    // Return original if encryption fails (fallback for legacy data)
    return textStr;
  }
}

/**
 * Decrypts data encrypted with the encrypt function
 * @param encryptedData - Encrypted string (base64 encoded)
 * @returns Decrypted plain text
 */
export function decrypt(encryptedData: string | number): string {
  if (!encryptedData && encryptedData !== 0) return String(encryptedData || '');
  
  const dataStr = String(encryptedData);
  
  // Check if data is likely encrypted (base64/base64url with minimum length)
  if (!isLikelyEncrypted(dataStr)) {
    // Return as-is if it's plain text (legacy data)
    return dataStr;
  }
  
  try {
    const combined = Buffer.from(normalizeBase64OrUrl(dataStr), 'base64');

    // Support both:
    // - Current format: salt(64) + iv(16) + tag(16) + ciphertext
    // - Legacy format: iv(16) + tag(16) + ciphertext
    const LEGACY_MIN = IV_LENGTH + TAG_LENGTH; // 32 bytes

    if (combined.length < LEGACY_MIN) {
      // Too short to be any supported ciphertext payload.
      return dataStr;
    }

    const isCurrentFormat = combined.length >= ENCRYPTED_POSITION;

    const iv = isCurrentFormat
      ? combined.subarray(SALT_LENGTH, TAG_POSITION)
      : combined.subarray(0, IV_LENGTH);
    const tag = isCurrentFormat
      ? combined.subarray(TAG_POSITION, ENCRYPTED_POSITION)
      : combined.subarray(IV_LENGTH, LEGACY_MIN);
    const encrypted = isCurrentFormat
      ? combined.subarray(ENCRYPTED_POSITION)
      : combined.subarray(LEGACY_MIN);

    const tryDecryptWithKey = (key: Buffer): string | null => {
      try {
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        return decrypted.toString('utf8');
      } catch {
        return null;
      }
    };

    // Try primary key first, then optional fallbacks, then default-key fallback (legacy).
    const primaryKey = getEncryptionKey();
    const primarySecret = normalizeEnvSecret(String(process.env.ENCRYPTION_KEY ?? ''));

    const primaryResult = tryDecryptWithKey(primaryKey);
    if (primaryResult != null) return primaryResult;

    const fallbackKeys = primarySecret ? getFallbackEncryptionKeys(primarySecret) : [];
    for (const fk of fallbackKeys) {
      const r = tryDecryptWithKey(fk);
      if (r != null) return r;
    }

    // Backward-compat: if ENCRYPTION_KEY is now set but some rows were encrypted
    // when it was missing (default key), try the default key once.
    if (process.env.ENCRYPTION_KEY) {
      const fallbackKey = getDefaultEncryptionKey();
      const r = tryDecryptWithKey(fallbackKey);
      if (r != null) return r;
    }

    throw new Error('Decryption failed for all keys');
  } catch (error) {
    // If decryption fails, return original (likely plain text or wrong key).
    // Avoid spamming logs on every field/record in production, which can severely hurt performance.
    const shouldLog = process.env.LOG_DECRYPT_ERRORS === 'true' || process.env.NODE_ENV !== 'production';
    if (shouldLog) {
      // Basic rate limit per process
      (globalThis as any).__decryptErrorCount = ((globalThis as any).__decryptErrorCount || 0) + 1;
      const count = (globalThis as any).__decryptErrorCount;
      if (count <= 5) {
        console.error('Decryption error:', {
          error: error instanceof Error ? error.message : String(error),
          dataLength: dataStr.length,
          dataPreview: dataStr.substring(0, 50) + '...',
          hasEncryptionKey: !!process.env.ENCRYPTION_KEY,
          hasFallbacks: Boolean(String(process.env.ENCRYPTION_KEY_FALLBACKS ?? '').trim()),
        });
      }
    }
    return dataStr;
  }
}

/**
 * Check if string is likely encrypted (base64 with minimum length)
 */
function isLikelyEncrypted(str: string): boolean {
  // Encrypted data will be base64 or base64url and longer than ENCRYPTED_POSITION chars
  // - base64: A-Z a-z 0-9 + / and optional padding '='
  // - base64url: A-Z a-z 0-9 - _ and no padding
  const base64OrUrlRegex = /^[A-Za-z0-9+/_=-]+$/;

  // Guardrails:
  // - keep minimum length low enough to support legacy ciphertext
  // Note: ciphertext can be letters-only by chance, so don't require digits/symbols.
  // 32 bytes (legacy IV+TAG) base64-encodes to 44 chars, so use that as a floor.
  const minLen = 44;
  return base64OrUrlRegex.test(str) && str.length >= minLen;
}

/**
 * Encrypts to a URL-safe token (base64url) suitable for use in path/query without extra escaping.
 */
export function encryptUrlSafe(text: string | number): string {
  return toBase64Url(encrypt(text));
}

/**
 * Decrypts tokens produced by encryptUrlSafe (also supports legacy base64 output from encrypt).
 */
export function decryptUrlSafe(token: string | number): string {
  if (typeof token === 'number') return decrypt(token);
  const tokenStr = String(token ?? '');
  // decrypt() now supports base64url too, but keep this wrapper for clarity.
  return decrypt(tokenStr);
}

/**
 * Encrypts sensitive fields in a subscription object
 * @param subscription - Subscription object with sensitive data
 * @returns Subscription with encrypted sensitive fields
 */
export function encryptSubscriptionData(subscription: any): any {
  if (!subscription) return subscription;
  
  const encrypted = { ...subscription };
  
  // Encrypt sensitive fields
  if (encrypted.serviceName !== undefined && encrypted.serviceName !== null) {
encrypted.serviceName = encrypt(encrypted.serviceName);
}
  if (encrypted.amount !== undefined && encrypted.amount !== null) {
    encrypted.amount = encrypt(String(encrypted.amount));
  }
  if (encrypted.vendor !== undefined && encrypted.vendor !== null) {
    encrypted.vendor = encrypt(encrypted.vendor);
  }
  if (encrypted.description !== undefined && encrypted.description !== null) {
    encrypted.description = encrypt(encrypted.description);
  }
  if (encrypted.paymentMethod !== undefined && encrypted.paymentMethod !== null) {
    encrypted.paymentMethod = encrypt(encrypted.paymentMethod);
  }
  if (encrypted.notes !== undefined && encrypted.notes !== null && encrypted.notes !== '') {
    encrypted.notes = encrypt(encrypted.notes);
  }
  
  return encrypted;
}

/**
 * Decrypts sensitive fields in a subscription object
 * @param subscription - Subscription object with encrypted data
 * @returns Subscription with decrypted sensitive fields
 */
export function decryptSubscriptionData(subscription: any): any {
  if (!subscription) return subscription;
  
  const decrypted = { ...subscription };
  
  // Decrypt sensitive fields
  try {
    if (decrypted.serviceName !== undefined && decrypted.serviceName !== null) {
      decrypted.serviceName = decrypt(decrypted.serviceName);
    }
    if (decrypted.amount !== undefined && decrypted.amount !== null) {
      const decryptedAmount = decrypt(decrypted.amount);
      // Keep as string or convert to number based on original type
      decrypted.amount = decryptedAmount;
    }
    if (decrypted.vendor !== undefined && decrypted.vendor !== null) {
      decrypted.vendor = decrypt(decrypted.vendor);
    }
    if (decrypted.description !== undefined && decrypted.description !== null) {
      decrypted.description = decrypt(decrypted.description);
    }
    if (decrypted.paymentMethod !== undefined && decrypted.paymentMethod !== null) {
      decrypted.paymentMethod = decrypt(decrypted.paymentMethod);
    }
    if (decrypted.notes !== undefined && decrypted.notes !== null && decrypted.notes !== '') {
      decrypted.notes = decrypt(decrypted.notes);
    }
  } catch (error) {
    console.error('Error decrypting subscription data:', error);
    // Return as-is if decryption fails (might be unencrypted legacy data)
  }
  
  return decrypted;
}

/**
 * Encrypts an array of subscriptions
 */
export function encryptSubscriptions(subscriptions: any[]): any[] {
  return subscriptions.map(sub => encryptSubscriptionData(sub));
}

/**
 * Decrypts an array of subscriptions
 */
export function decryptSubscriptions(subscriptions: any[]): any[] {
  return subscriptions.map(sub => decryptSubscriptionData(sub));
}

/**
 * Generates a cryptographically secure random key for encryption
 * Use this to generate ENCRYPTION_KEY for your .env file
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generates a cryptographically secure JWT secret
 * Use this to generate JWT_SECRET for your .env file
 */
export function generateJWTSecret(): string {
  return crypto.randomBytes(64).toString('hex');
}

// Export utility for generating keys (run once to generate secrets)
if (require.main === module) {
console.log('ENCRYPTION_KEY=' + generateEncryptionKey());
}
