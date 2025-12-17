import crypto from 'crypto';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

// Get encryption key from environment or generate a strong one
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    console.warn('ENCRYPTION_KEY not set in environment. Using default (NOT SECURE FOR PRODUCTION)');
    // In production, this should throw an error
    return crypto.scryptSync('default-key-change-this', 'salt', 32);
  }
  // Derive a 256-bit key from the provided key
  return crypto.scryptSync(key, 'salt', 32);
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
  
  // Check if data is likely encrypted (base64 has specific pattern)
  if (!isLikelyEncrypted(dataStr)) {
    // Return as-is if it's plain text (legacy data)
    return dataStr;
  }
  
  try {
    const combined = Buffer.from(dataStr, 'base64');
    
    // Check if buffer is valid size
    if (combined.length < ENCRYPTED_POSITION) {
      console.warn('Buffer too short for encrypted data, returning as-is');
      return dataStr; // Return plain if too short to be encrypted
    }
    
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, TAG_POSITION);
    const tag = combined.subarray(TAG_POSITION, ENCRYPTED_POSITION);
    const encrypted = combined.subarray(ENCRYPTED_POSITION);
    
    const key = getEncryptionKey();
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const result = decrypted.toString('utf8');
    return result;
  } catch (error) {
    // If decryption fails, return original (likely plain text)
    console.error('Decryption error:', {
      error: error instanceof Error ? error.message : String(error),
      dataLength: dataStr.length,
      dataPreview: dataStr.substring(0, 50) + '...',
      hasEncryptionKey: !!process.env.ENCRYPTION_KEY
    });
    return dataStr;
  }
}

/**
 * Check if string is likely encrypted (base64 with minimum length)
 */
function isLikelyEncrypted(str: string): boolean {
  // Encrypted data will be base64 and longer than ENCRYPTED_POSITION chars
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  return base64Regex.test(str) && str.length > 100;
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
