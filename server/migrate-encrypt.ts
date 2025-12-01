/**
 * Migration Script: Encrypt Existing Subscription Data
 * 
 * This script encrypts all existing plain-text subscription data in MongoDB
 * Run this ONCE after implementing encryption to secure existing data
 * 
 * Usage: npm run migrate-encrypt
 */

import { connectToDatabase } from './mongo.js';
import { encryptSubscriptionData } from './encryption.service.js';
import dotenv from 'dotenv';

dotenv.config();

async function migrateEncryptSubscriptions() {
  console.log('\n🔐 Starting subscription data encryption migration...\n');
  
  try {
    const db = await connectToDatabase();
    const collection = db.collection('subscriptions');
    
    // Get all subscriptions
    const subscriptions = await collection.find({}).toArray();
    console.log(`📊 Found ${subscriptions.length} subscriptions to process\n`);
    
    let encrypted = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const sub of subscriptions) {
      try {
        // Check if data is already encrypted (base64 pattern with length > 100)
        const isAlreadyEncrypted = 
          typeof sub.serviceName === 'string' && 
          sub.serviceName.length > 100 && 
          /^[A-Za-z0-9+/]+=*$/.test(sub.serviceName);
        
        if (isAlreadyEncrypted) {
          console.log(`⏭️  Skipping ${sub._id} - Already encrypted`);
          skipped++;
          continue;
        }
        
        // Encrypt the subscription data
        const encryptedData = encryptSubscriptionData({
          serviceName: sub.serviceName,
          amount: sub.amount,
          vendor: sub.vendor,
          description: sub.description,
          paymentMethod: sub.paymentMethod,
          notes: sub.notes
        });
        
        // Update in database
        await collection.updateOne(
          { _id: sub._id },
          { 
            $set: {
              serviceName: encryptedData.serviceName,
              amount: encryptedData.amount,
              vendor: encryptedData.vendor || sub.vendor,
              description: encryptedData.description || sub.description,
              paymentMethod: encryptedData.paymentMethod || sub.paymentMethod,
              notes: encryptedData.notes || sub.notes,
              encryptedAt: new Date()
            }
          }
        );
        
        console.log(`✅ Encrypted: ${sub.serviceName} (${sub._id})`);
        encrypted++;
        
      } catch (error) {
        console.error(`❌ Error encrypting ${sub._id}:`, error);
        errors++;
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(50));
    console.log(`✅ Successfully encrypted: ${encrypted}`);
    console.log(`⏭️  Already encrypted (skipped): ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📝 Total processed: ${subscriptions.length}`);
    console.log('='.repeat(50) + '\n');
    
    if (encrypted > 0) {
      console.log('🎉 Migration completed successfully!');
      console.log('💡 All new subscriptions will be automatically encrypted.\n');
    } else if (skipped === subscriptions.length) {
      console.log('✨ All data is already encrypted. No action needed.\n');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateEncryptSubscriptions();
