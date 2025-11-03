// Simple monthly reminder service for sending email reminders on the 25th of every month
// This service identifies subscriptions renewing next month and logs/emails the owners

export class MonthlyReminderService {
  constructor(private storage: any) {} // Using any for now to avoid type issues

  /**
   * Runs on the 25th of every month to send reminder emails
   * for subscriptions renewing next month
   */
  async sendMonthlyReminders(): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      console.log('Starting monthly reminder process...');
      
      // Get current date and calculate next month's date range
      const today = new Date();
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const endOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);
      
      console.log(`Looking for renewals between ${nextMonth.toISOString().split('T')[0]} and ${endOfNextMonth.toISOString().split('T')[0]}`);
      
      // For now, process reminders for default tenant
      const result = await this.processTenantReminders('default', nextMonth, endOfNextMonth);
      
      console.log('Monthly reminder process completed');
      return {
        success: true,
        message: 'Monthly reminders processed successfully',
        data: result
      };
    } catch (error: any) {
      console.error('Error in monthly reminder process:', error);
      return {
        success: false,
        message: `Error processing monthly reminders: ${error.message}`
      };
    }
  }

  private async processTenantReminders(tenantId: string, startDate: Date, endDate: Date): Promise<any> {
    try {
      // Get all subscriptions for this tenant that renew next month
      const subscriptions = await this.storage.getSubscriptions(tenantId);
      
      const nextMonthRenewals = subscriptions.filter((sub: any) => {
        if (!sub.nextRenewal) return false;
        const renewalDate = new Date(sub.nextRenewal);
        return renewalDate >= startDate && renewalDate <= endDate;
      });

      if (nextMonthRenewals.length === 0) {
        console.log(`No renewals found for tenant ${tenantId} next month`);
        return { renewals: [], emailsSent: 0 };
      }

      console.log(`Found ${nextMonthRenewals.length} renewals for tenant ${tenantId}`);

      // Group subscriptions by owner
      const subscriptionsByOwner = this.groupSubscriptionsByOwner(nextMonthRenewals);

      const emailResults = [];
      const owners = Array.from(subscriptionsByOwner.entries());
      
      for (const [ownerEmail, ownerSubscriptions] of owners) {
        if (!ownerEmail || !this.isValidEmail(ownerEmail)) {
          console.log(`Skipping invalid email: ${ownerEmail}`);
          continue;
        }

        const emailResult = await this.prepareReminderEmail(ownerEmail, ownerSubscriptions, startDate);
        emailResults.push(emailResult);
      }

      // Create monthly reminder records for tracking
      await this.createMonthlyReminderRecords(tenantId, nextMonthRenewals);

      return {
        renewals: nextMonthRenewals,
        emailsSent: emailResults.length,
        emailResults
      };

    } catch (error) {
      console.error(`Error processing reminders for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  private groupSubscriptionsByOwner(subscriptions: any[]): Map<string, any[]> {
    const grouped = new Map<string, any[]>();
    
    for (const subscription of subscriptions) {
      // Try to get owner email
      let ownerEmail = '';
      
      if (subscription.owner) {
        // If owner is an email address
        if (this.isValidEmail(subscription.owner)) {
          ownerEmail = subscription.owner;
        } else {
          // For now, skip non-email owners - you can enhance this to lookup employee emails
          console.log(`Owner '${subscription.owner}' is not an email address for subscription: ${subscription.serviceName}`);
          continue;
        }
      }
      
      // Skip if no owner email
      if (!ownerEmail) {
        console.log(`No owner email found for subscription: ${subscription.serviceName}`);
        continue;
      }
      
      if (!grouped.has(ownerEmail)) {
        grouped.set(ownerEmail, []);
      }
      grouped.get(ownerEmail)!.push(subscription);
    }
    
    return grouped;
  }

  private async prepareReminderEmail(ownerEmail: string, subscriptions: any[], nextMonth: Date): Promise<any> {
    try {
      const ownerName = this.extractNameFromEmail(ownerEmail);
      const monthName = nextMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      
      const emailData = {
        to: ownerEmail,
        ownerName,
        monthName,
        subscriptions: subscriptions.map(sub => ({
          serviceName: sub.serviceName,
          vendor: sub.vendor || 'N/A',
          amount: sub.amount || 0,
          currency: sub.currency || 'USD',
          nextRenewal: sub.nextRenewal,
          billingCycle: sub.billingCycle || 'Monthly',
          category: sub.category
        })),
        totalAmount: subscriptions.reduce((total, sub) => total + (parseFloat(sub.amount || 0)), 0),
        totalCount: subscriptions.length
      };

      // For now, just log the email data - you can integrate with actual email service later
      console.log(`\n📧 REMINDER EMAIL TO: ${ownerEmail}`);
      console.log(`Subject: 📅 Subscription Renewals for ${monthName}`);
      console.log(`Subscriptions (${emailData.totalCount}):`);
      
      emailData.subscriptions.forEach((sub, index) => {
        console.log(`  ${index + 1}. ${sub.serviceName} - ${sub.currency} ${sub.amount} (${new Date(sub.nextRenewal).toLocaleDateString()})`);
      });
      
      console.log(`Total Estimated Amount: ${emailData.subscriptions[0]?.currency || 'USD'} ${emailData.totalAmount.toFixed(2)}\n`);

      return {
        success: true,
        ownerEmail,
        subscriptionCount: emailData.totalCount,
        totalAmount: emailData.totalAmount,
        emailData
      };
    } catch (error: any) {
      console.error(`Error preparing reminder email for ${ownerEmail}:`, error);
      return {
        success: false,
        ownerEmail,
        error: error.message
      };
    }
  }

  private async createMonthlyReminderRecords(tenantId: string, subscriptions: any[]): Promise<void> {
    try {
      for (const subscription of subscriptions) {
        const reminderData = {
          subscriptionId: subscription.id,
          alertDays: 30, // Sent ~30 days before (since we send on 25th for next month)
          emailEnabled: true,
          whatsappEnabled: false,
          reminderType: 'monthly_recurring',
          monthlyDay: 25
        };

        await this.storage.createReminder(reminderData, tenantId);
      }
      console.log(`Created ${subscriptions.length} monthly reminder records`);
    } catch (error) {
      console.error('Error creating monthly reminder records:', error);
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private extractNameFromEmail(email: string): string {
    return email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Check if today is the 25th and run reminders if so
   */
  async checkAndRunDailyReminders(): Promise<{ shouldRun: boolean; result?: any }> {
    const today = new Date();
    const dayOfMonth = today.getDate();
    
    if (dayOfMonth === 25) {
      console.log('Today is the 25th - running monthly reminders');
      const result = await this.sendMonthlyReminders();
      return { shouldRun: true, result };
    } else {
      console.log(`Today is the ${dayOfMonth}th - monthly reminders run on the 25th`);
      return { shouldRun: false };
    }
  }

  /**
   * Manual trigger for testing or admin use
   */
  async triggerManualReminders(): Promise<any> {
    console.log('Manually triggering monthly reminders (ignoring date)');
    return await this.sendMonthlyReminders();
  }
}

// Create a singleton instance
let monthlyReminderService: MonthlyReminderService | null = null;

export const getMonthlyReminderService = (storage: any): MonthlyReminderService => {
  if (!monthlyReminderService) {
    monthlyReminderService = new MonthlyReminderService(storage);
  }
  return monthlyReminderService;
};