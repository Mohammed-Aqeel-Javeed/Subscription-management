#!/usr/bin/env node

// Daily reminder checker script
// This script should be run daily via cron job to check if reminders should be sent
// Add this to your crontab: 0 9 * * * /path/to/node /path/to/this/script.js

import { storage } from '../server/storage.js';
import { getMonthlyReminderService } from '../server/monthly-reminder.service.js';

async function runDailyReminderCheck() {
  try {
    console.log('🕘 Running daily reminder check...');
    console.log('Date:', new Date().toISOString());
    
    const reminderService = getMonthlyReminderService(storage);
    const result = await reminderService.checkAndRunDailyReminders();
    
    if (result.shouldRun) {
      console.log('✅ Monthly reminders were sent!');
      console.log('Result:', JSON.stringify(result.result, null, 2));
    } else {
      console.log('ℹ️  No reminders to send today (not the 25th)');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error running daily reminder check:', error);
    process.exit(1);
  }
}

// Only run if this script is called directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  runDailyReminderCheck();
}