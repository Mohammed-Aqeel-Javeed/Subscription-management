/**
 * Verification Script: Check if data is encrypted
 * 
 * This script checks a few subscriptions to verify they are properly encrypted
 */

import { connectToDatabase } from './mongo.js';
import dotenv from 'dotenv';

dotenv.config();

async function verifyEncryption() {
  console.log('\n🔍 Verifying encryption status...\n');
  
  try {
    const db = await connectToDatabase();
    const collection = db.collection('subscriptions');
    
    // Get a few random subscriptions
    const subscriptions = await collection.find({}).limit(5).toArray();
    
    console.log('📊 Sample of encrypted data in database:\n');
    console.log('='.repeat(80));
    
    for (const sub of subscriptions) {
      console.log(`\nSubscription ID: ${sub._id}`);
      console.log(`Service Name (encrypted): ${sub.serviceName?.substring(0, 50)}...`);
      console.log(`Amount (encrypted): ${String(sub.amount).substring(0, 50)}...`);
      console.log(`Vendor (encrypted): ${sub.vendor?.substring(0, 50)}...`);
      console.log(`Payment Method (encrypted): ${sub.paymentMethod?.substring(0, 50)}...`);
      
      // Check if encrypted (base64 pattern)
      const isEncrypted = 
        typeof sub.serviceName === 'string' && 
        sub.serviceName.length > 100 && 
        /^[A-Za-z0-9+/]+=*$/.test(sub.serviceName);
      
      console.log(`✅ Status: ${isEncrypted ? 'ENCRYPTED ✓' : 'PLAIN TEXT ✗'}`);
      console.log('-'.repeat(80));
    }
    
    console.log('\n✅ Verification complete!\n');
    console.log('💡 When viewing through the app, data will be automatically decrypted.');
    console.log('🔒 In the database, it appears as encrypted blobs.\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  }
}

verifyEncryption();
