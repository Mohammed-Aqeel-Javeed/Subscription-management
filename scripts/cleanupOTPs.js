import { connectToDatabase } from '../server/mongo.js';

async function cleanupExpiredOTPs() {
  try {
    console.log('🧹 Starting OTP cleanup...');
    
    const db = await connectToDatabase();
    const now = new Date();
    
    // Delete expired OTPs
    const result = await db.collection('otps').deleteMany({
      expiresAt: { $lt: now }
    });
    
    console.log(`✅ Cleaned up ${result.deletedCount} expired OTPs`);
    
    // Also delete OTPs that are older than 24 hours (verified or not)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oldResult = await db.collection('otps').deleteMany({
      createdAt: { $lt: oneDayAgo }
    });
    
    console.log(`✅ Cleaned up ${oldResult.deletedCount} old OTPs (>24h)`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error cleaning up OTPs:', error);
    process.exit(1);
  }
}

cleanupExpiredOTPs();
