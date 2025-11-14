// Simple debug script to test the monthly reminder logic
import { storage } from './server/storage.js';

async function debugReminders() {
  console.log('=== Debug Monthly Reminders ===');
  
  const tenantId = 'tenant-3ylxgng5x-175567829258';
  console.log(`\nTesting tenant: ${tenantId}`);
  
  try {
    // Get subscriptions
    const subscriptions = await storage.getSubscriptions(tenantId);
    console.log(`\nFound ${subscriptions.length} subscriptions:`);
    
    subscriptions.forEach((sub, index) => {
      console.log(`\n${index + 1}. Subscription:`);
      console.log(`   Service: ${sub.serviceName}`);
      console.log(`   Next Renewal: ${sub.nextRenewal}`);
      console.log(`   Owner: ${sub.owner || 'NOT SET'}`);
      console.log(`   Status: ${sub.status}`);
      console.log(`   Tenant: ${sub.tenantId}`);
    });
    
    // Test date filtering
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const endOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    
    console.log(`\nDate range check:`);
    console.log(`   Today: ${today.toLocaleDateString()}`);
    console.log(`   Next month start: ${nextMonth.toLocaleDateString()}`);
    console.log(`   Next month end: ${endOfNextMonth.toLocaleDateString()}`);
    
    const validRenewals = subscriptions.filter(sub => {
      if (!sub.nextRenewal) return false;
      const renewalDate = new Date(sub.nextRenewal);
      const inRange = renewalDate >= nextMonth && renewalDate <= endOfNextMonth;
      console.log(`   ${sub.serviceName}: ${renewalDate.toLocaleDateString()} → ${inRange ? 'INCLUDED' : 'excluded'}`);
      return inRange;
    });
    
    console.log(`\nFound ${validRenewals.length} subscriptions renewing next month`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugReminders().catch(console.error);