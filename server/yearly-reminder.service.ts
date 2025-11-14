// Yearly reminder service for sending email reminders based on reminder days before renewal
// This checks daily for subscriptions that need reminders sent

import { emailService } from './email.service.js';

export class YearlyReminderService {
  constructor(private storage: any) {}

  /**
   * Checks daily for yearly subscriptions that need reminder emails
   * Sends reminders X days before renewal date (where X = reminder days)
   */
  async checkAndSendYearlyReminders(): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      console.log('Starting yearly reminder check...');
      
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today
      
      // Get all tenants
      const allTenants = await this.getAllTenantIds();
      console.log(`Found ${allTenants.length} tenants: ${allTenants.join(', ')}`);
      
      let totalResult = {
        remindersSent: 0,
        emailsSent: 0,
        subscriptionsChecked: 0,
        emailResults: [] as any[]
      };
      
      // Process reminders for all tenants
      for (const tenantId of allTenants) {
        console.log(`Checking yearly reminders for tenant: ${tenantId}`);
        const result = await this.processTenantYearlyReminders(tenantId, today);
        
        totalResult.remindersSent += result.remindersSent;
        totalResult.emailsSent += result.emailsSent;
        totalResult.subscriptionsChecked += result.subscriptionsChecked;
        totalResult.emailResults.push(...result.emailResults);
      }
      
      console.log(`Yearly reminder check complete. Checked: ${totalResult.subscriptionsChecked}, Reminders: ${totalResult.remindersSent}, Emails: ${totalResult.emailsSent}`);
      
      return {
        success: true,
        message: `Yearly reminder check complete`,
        data: totalResult
      };
    } catch (error: any) {
      console.error('Error in yearly reminder check:', error);
      return {
        success: false,
        message: `Error: ${error?.message || error}`
      };
    }
  }

  /**
   * Process yearly reminders for a specific tenant
   */
  private async processTenantYearlyReminders(tenantId: string, today: Date): Promise<any> {
    try {
      // Get all active subscriptions for this tenant
      const allSubscriptions = await this.storage.getSubscriptions(tenantId);
      
      console.log(`Retrieved ${allSubscriptions.length} total subscriptions for tenant ${tenantId}`);
      
      // Filter for yearly commitment subscriptions only
      // Note: "Commitment cycle" in UI is stored as "billingCycle" in DB
      const yearlySubscriptions = allSubscriptions.filter((sub: any) => {
        const hasNextRenewal = sub.nextRenewal || sub.nextRenewalDate;
        const isYearly = sub.billingCycle?.toLowerCase() === 'yearly' || sub.commitmentCycle?.toLowerCase() === 'yearly';
        console.log(`Checking ${sub.serviceName}: isActive=${sub.isActive}, billingCycle=${sub.billingCycle}, isYearly=${isYearly}, hasNextRenewal=${!!hasNextRenewal}`);
        return sub.isActive && 
               isYearly &&
               hasNextRenewal;
      });
      
      console.log(`Found ${yearlySubscriptions.length} active yearly subscriptions for tenant ${tenantId}`);
      console.log(`All subscriptions:`, allSubscriptions.map((s: any) => ({ 
        name: s.serviceName, 
        billingCycle: s.billingCycle,
        commitmentCycle: s.commitmentCycle,
        paymentFrequency: s.paymentFrequency,
        nextRenewalDate: s.nextRenewalDate,
        nextRenewal: s.nextRenewal,
        reminderDays: s.reminderDays,
        isActive: s.isActive
      })));
      
      let remindersSent = 0;
      let emailsSent = 0;
      const emailResults: any[] = [];
      
      // Check each yearly subscription
      for (const subscription of yearlySubscriptions) {
        // Use nextRenewal or nextRenewalDate
        const renewalDate = new Date(subscription.nextRenewal || subscription.nextRenewalDate);
        renewalDate.setHours(0, 0, 0, 0);
        
        const reminderDays = subscription.reminderDays || 7; // Default to 7 days if not set
        
        // Calculate the reminder date (renewal date - reminder days)
        const reminderDate = new Date(renewalDate);
        reminderDate.setDate(reminderDate.getDate() - reminderDays);
        
        console.log(`Checking subscription: ${subscription.serviceName}`);
        console.log(`  - Renewal Date: ${renewalDate.toISOString().split('T')[0]}`);
        console.log(`  - Reminder Days: ${reminderDays}`);
        console.log(`  - Reminder Date: ${reminderDate.toISOString().split('T')[0]}`);
        console.log(`  - Today: ${today.toISOString().split('T')[0]}`);
        console.log(`  - Matches: ${this.isSameDate(today, reminderDate)}`);
        
        // Check if today is the reminder date
        if (this.isSameDate(today, reminderDate)) {
          console.log(`✓ Reminder needed for subscription: ${subscription.serviceName} (Renewal: ${renewalDate.toISOString().split('T')[0]}, Reminder Days: ${reminderDays})`);
          
          // Check if reminder was already sent today
          const alreadySent = await this.wasReminderSentToday(subscription.id, tenantId);
          
          if (!alreadySent) {
            // Get owner email
            const ownerEmail = await this.getOwnerEmail(subscription, tenantId);
            
            if (ownerEmail && this.isValidEmail(ownerEmail)) {
              // Send email
              const emailSent = await this.sendYearlyReminderEmail(
                ownerEmail,
                subscription,
                renewalDate,
                reminderDays
              );
              
              if (emailSent) {
                emailsSent++;
                // Create reminder record to track that we sent it
                await this.createReminderRecord(subscription, tenantId);
              }
              
              emailResults.push({
                subscription: subscription.serviceName,
                owner: subscription.owner,
                ownerEmail,
                emailSent,
                renewalDate: renewalDate.toISOString().split('T')[0],
                reminderDays
              });
            } else {
              console.log(`Skipping subscription ${subscription.serviceName} - no valid owner email`);
              emailResults.push({
                subscription: subscription.serviceName,
                owner: subscription.owner,
                ownerEmail: ownerEmail || 'none',
                emailSent: false,
                error: 'No valid email',
                renewalDate: renewalDate.toISOString().split('T')[0],
                reminderDays
              });
            }
            
            remindersSent++;
          } else {
            console.log(`Reminder already sent today for subscription: ${subscription.serviceName}`);
          }
        }
      }
      
      return {
        subscriptionsChecked: yearlySubscriptions.length,
        remindersSent,
        emailsSent,
        emailResults
      };
    } catch (error) {
      console.error(`Error processing tenant ${tenantId}:`, error);
      return {
        subscriptionsChecked: 0,
        remindersSent: 0,
        emailsSent: 0,
        emailResults: [],
        error: (error as any)?.message || 'Unknown error'
      };
    }
  }

  /**
   * Send yearly reminder email to owner
   */
  private async sendYearlyReminderEmail(
    ownerEmail: string,
    subscription: any,
    renewalDate: Date,
    reminderDays: number
  ): Promise<boolean> {
    try {
      const daysUntilRenewal = Math.ceil((renewalDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      
      const subject = `⏰ Renewal Reminder: ${subscription.serviceName} renews in ${daysUntilRenewal} days`;
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .subscription-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #667eea; }
            .info-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 10px 0; border-bottom: 1px solid #eee; }
            .label { font-weight: bold; color: #667eea; }
            .value { color: #333; }
            .alert { background: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⏰ Subscription Renewal Reminder</h1>
            </div>
            <div class="content">
              <div class="alert">
                <strong>🔔 Reminder:</strong> Your subscription is set to renew in <strong>${daysUntilRenewal} days</strong>
              </div>
              
              <div class="subscription-box">
                <h2>${subscription.serviceName}</h2>
                
                <div class="info-row">
                  <span class="label">Vendor:</span>
                  <span class="value">${subscription.vendor || 'N/A'}</span>
                </div>
                
                <div class="info-row">
                  <span class="label">Renewal Date:</span>
                  <span class="value">${renewalDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                
                <div class="info-row">
                  <span class="label">Amount:</span>
                  <span class="value">${subscription.amount} ${subscription.currency || 'USD'}</span>
                </div>
                
                <div class="info-row">
                  <span class="label">Payment Method:</span>
                  <span class="value">${subscription.paymentMethod || 'N/A'}</span>
                </div>
                
                <div class="info-row">
                  <span class="label">Category:</span>
                  <span class="value">${subscription.category || 'N/A'}</span>
                </div>
              </div>
              
              <p style="margin-top: 20px;">
                Please ensure sufficient funds are available in your account for the renewal.
                If you wish to cancel this subscription, please do so before the renewal date.
              </p>
              
              <div class="footer">
                <p>This is an automated reminder from your Subscription Tracker</p>
                <p>Reminder set for ${reminderDays} days before renewal</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;
      
      const result = await emailService.sendEmail({
        to: ownerEmail,
        subject,
        html
      });
      
      if (result) {
        console.log(`✓ Yearly reminder email sent to ${ownerEmail} for ${subscription.serviceName}`);
      } else {
        console.log(`✗ Failed to send yearly reminder email to ${ownerEmail}`);
      }
      
      return result;
    } catch (error: any) {
      console.error('Error sending yearly reminder email:', error);
      return false;
    }
  }

  /**
   * Get owner email from subscription
   */
  private async getOwnerEmail(subscription: any, tenantId: string): Promise<string | null> {
    // First check if ownerEmail is directly available
    if (subscription.ownerEmail && this.isValidEmail(subscription.ownerEmail)) {
      return subscription.ownerEmail;
    }
    
    // Fallback: lookup by owner name
    if (subscription.owner) {
      return await this.getEmployeeEmailByName(subscription.owner, tenantId);
    }
    
    return null;
  }

  /**
   * Get employee email by name from users collection
   */
  private async getEmployeeEmailByName(employeeName: string, tenantId: string): Promise<string | null> {
    try {
      const users = await this.storage.getUsers(tenantId);
      const user = users.find((u: any) => u.name === employeeName);
      return user?.email || null;
    } catch (error: any) {
      console.error('Error getting employee email:', error);
      return null;
    }
  }

  /**
   * Check if two dates are the same day
   */
  private isSameDate(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  /**
   * Check if reminder was already sent today
   */
  private async wasReminderSentToday(subscriptionId: number, tenantId: string): Promise<boolean> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const allReminders = await this.storage.getReminders(tenantId);
      const reminders = allReminders.filter((r: any) => r.subscriptionId === subscriptionId);
      
      // Check if there's a yearly reminder record created today
      const todayReminder = reminders.find((r: any) => {
        if (r.reminderType !== 'yearly_individual') return false;
        const reminderDate = new Date(r.createdAt);
        reminderDate.setHours(0, 0, 0, 0);
        return this.isSameDate(reminderDate, today);
      });
      
      return !!todayReminder;
    } catch (error: any) {
      console.error('Error checking if reminder was sent:', error);
      return false;
    }
  }

  /**
   * Create reminder record to track that we sent it
   */
  private async createReminderRecord(subscription: any, tenantId: string): Promise<void> {
    try {
      const reminderData = {
        subscriptionId: subscription.id,
        alertDays: subscription.reminderDays || 7,
        emailEnabled: true,
        whatsappEnabled: false,
        reminderType: 'yearly_individual'
      };

      await this.storage.createReminder(reminderData, tenantId);
    } catch (error: any) {
      console.error('Error creating reminder record:', error);
    }
  }

  /**
   * Get all unique tenant IDs from the database
   */
  private async getAllTenantIds(): Promise<string[]> {
    try {
      const { connectToDatabase } = await import("./mongo.js");
      const db = await connectToDatabase();
      
      const tenantIds = await db.collection('subscriptions').distinct('tenantId', { isActive: true });
      return tenantIds.filter((id: string) => id && id.trim().length > 0);
    } catch (error: any) {
      console.error('Error getting tenant IDs:', error);
      return [];
    }
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Manual trigger for testing
   */
  async triggerManualYearlyReminders(): Promise<any> {
    console.log('Manually triggering yearly reminders check');
    return await this.checkAndSendYearlyReminders();
  }
}

// Create a singleton instance
let yearlyReminderService: YearlyReminderService | null = null;

export const getYearlyReminderService = (storage: any): YearlyReminderService => {
  if (!yearlyReminderService) {
    yearlyReminderService = new YearlyReminderService(storage);
  }
  return yearlyReminderService;
};
