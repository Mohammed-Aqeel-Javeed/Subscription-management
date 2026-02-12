#!/usr/bin/env node

// Daily compliance reminder checker script
// Run this daily via cron if you don't want the server scheduler.
// Example cron: 0 0 * * * /path/to/node /path/to/dailyComplianceReminderCheck.js

import { runComplianceReminderCheck } from '../server/compliance-reminder.service.js';

async function runDailyComplianceReminderCheck() {
  try {
    console.log('🕛 Running daily compliance reminder check...');
    console.log('Date:', new Date().toISOString());

    const result = await runComplianceReminderCheck();
    console.log('✅ Compliance reminder check complete');
    console.log('Result:', JSON.stringify(result, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('❌ Error running compliance reminder check:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDailyComplianceReminderCheck();
}
