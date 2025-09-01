// Run this with: node scripts/regenerateReminders.js
const { MongoClient, ObjectId } = require('mongodb');

const uri = 'mongodb://localhost:27017'; // Change if your MongoDB is remote or uses a different port
const dbName = 'SubscriptionTracker'; // Change if your DB name is different

async function regenerateReminders() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    
    // Get all subscriptions
    const subscriptions = await db.collection('subscriptions').find({}).toArray();
    console.log(`Found ${subscriptions.length} subscriptions`);
    
    let remindersCreated = 0;
    
    for (const subscription of subscriptions) {
      const {
        _id,
        tenantId,
        serviceName,
        reminderPolicy = 'One time',
        reminderDays = 7,
        nextRenewal,
        endDate
      } = subscription;
      
      if (!nextRenewal && !endDate) {
        console.log(`Skipping ${serviceName} - no renewal/end date`);
        continue;
      }
      
      // Delete existing reminders for this subscription
      await db.collection('reminders').deleteMany({ 
        $or: [
          { subscriptionId: _id.toString() },
          { subscriptionId: _id }
        ]
      });
      
      const renewalDate = new Date(nextRenewal || endDate);
      const today = new Date();
      const reminderDaysNum = Number(reminderDays);
      
      // Calculate reminder dates based on policy
      let reminderDates = [];
      
      if (reminderPolicy === 'One time') {
        const reminderDate = new Date(renewalDate);
        reminderDate.setDate(reminderDate.getDate() - reminderDaysNum);
        if (reminderDate >= today) {
          reminderDates.push(reminderDate);
        }
      } else if (reminderPolicy === 'Two times') {
        const firstReminderDate = new Date(renewalDate);
        firstReminderDate.setDate(firstReminderDate.getDate() - reminderDaysNum);
        
        const secondReminderDate = new Date(renewalDate);
        secondReminderDate.setDate(secondReminderDate.getDate() - Math.floor(reminderDaysNum / 2));
        
        if (firstReminderDate >= today) reminderDates.push(firstReminderDate);
        if (secondReminderDate >= today && secondReminderDate > firstReminderDate) {
          reminderDates.push(secondReminderDate);
        }
      } else if (reminderPolicy === 'Until Renewal') {
        const startDate = new Date(renewalDate);
        startDate.setDate(startDate.getDate() - reminderDaysNum);
        
        let currentDate = new Date(Math.max(startDate.getTime(), today.getTime()));
        while (currentDate <= renewalDate) {
          reminderDates.push(new Date(currentDate));
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
      
      // Create reminders
      for (const reminderDate of reminderDates) {
        const reminder = {
          subscriptionId: _id.toString(),
          tenantId,
          reminderDate: reminderDate.toISOString().slice(0, 10),
          reminderType: `${reminderPolicy} reminder`,
          sent: false,
          createdAt: new Date(),
          message: `Reminder: ${serviceName} renewal due on ${renewalDate.toISOString().slice(0, 10)}`
        };
        
        await db.collection('reminders').insertOne(reminder);
        remindersCreated++;
      }
      
      console.log(`Created ${reminderDates.length} reminders for ${serviceName}`);
    }
    
    console.log(`\nTotal reminders created: ${remindersCreated}`);
    
  } catch (err) {
    console.error('Error regenerating reminders:', err);
  } finally {
    await client.close();
  }
}

regenerateReminders();
