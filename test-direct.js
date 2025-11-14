console.log('Testing monthly reminder system...');

// Direct test of the monthly reminder service
import { storage } from './server/storage.js';

async function testReminders() {
  try {
    const tenantId = 'tenant-3ylxgng5x-175567829258';
    console.log(`\nTesting tenant: ${tenantId}`);
    
    // Get all subscriptions
    const subscriptions = await storage.getSubscriptions(tenantId);
    console.log(`Found ${subscriptions.length} total subscriptions`);
    
    // Check for December renewals
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const endOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    
    console.log(`Looking for renewals between ${nextMonth.toLocaleDateString()} and ${endOfNextMonth.toLocaleDateString()}`);
    
    const decemberRenewals = subscriptions.filter(sub => {
      if (!sub.nextRenewal) return false;
      const renewalDate = new Date(sub.nextRenewal);
      return renewalDate >= nextMonth && renewalDate <= endOfNextMonth;
    });
    
    console.log(`\nFound ${decemberRenewals.length} December renewals:`);
    decemberRenewals.forEach(sub => {
      console.log(`- ${sub.serviceName}: ${new Date(sub.nextRenewal).toLocaleDateString()} (Owner: ${sub.owner || 'NO_OWNER'})`);
    });
    
    // Test email lookup
    if (decemberRenewals.length > 0) {
      const employees = await storage.getUsers(tenantId);
      console.log(`\nFound ${employees.length} employees for email lookup`);
      
      for (const sub of decemberRenewals) {
        const owner = sub.owner;
        if (owner) {
          const employee = employees.find(emp => emp.name === owner);
          if (employee) {
            console.log(`✅ ${sub.serviceName} owner "${owner}" → ${employee.email}`);
          } else {
            console.log(`❌ ${sub.serviceName} owner "${owner}" → NO EMAIL FOUND`);
          }
        } else {
          console.log(`❌ ${sub.serviceName} → NO OWNER SET`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testReminders();