import { generateEncryptionKey, generateJWTSecret } from './encryption.service.js';

console.log('\n🔐 SECURE KEYS FOR PRODUCTION\n');
console.log('================================\n');
console.log('Copy these to your .env file:\n');
console.log('ENCRYPTION_KEY=' + generateEncryptionKey());
console.log('JWT_SECRET=' + generateJWTSecret());
console.log('\n================================');
console.log('⚠️  IMPORTANT: Keep these secret and never commit to git!\n');
