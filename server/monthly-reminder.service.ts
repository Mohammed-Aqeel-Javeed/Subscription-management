// Simple monthly reminder service for sending email reminders on the 13th of every month
// This service identifies subscriptions renewing next month and logs/emails the owners

import { emailService } from './email.service.js';

export class MonthlyReminderService {
  constructor(private storage: any) {} // Using any for now to avoid type issues

  /**
   * Runs on the 13th of every month to send reminder emails
   * for subscriptions renewing next month
   * @param specificTenantId - Optional: only process reminders for this tenant
   */
  async sendMonthlyReminders(specificTenantId?: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
// Get current date and calculate next month's date range
      const today = new Date();
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const endOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);
      
      console.log(`Looking for renewals between ${nextMonth.toISOString().split('T')[0]} and ${endOfNextMonth.toISOString().split('T')[0]}`);
      
      // Get all tenants or use specific tenant
      let allTenants: string[];
      if (specificTenantId) {
        allTenants = [specificTenantId];
} else {
        allTenants = await this.getAllTenantIds();
        console.log(`Found ${allTenants.length} tenants: ${allTenants.join(', ')}`);
      }
      
      let totalResult = {
        renewals: [] as any[],
        emailsSent: 0,
        emailResults: [] as any[],
        debugDetails: [] as any[],
        ownerSummaries: [] as any[]
      };
      
      // Process reminders for all tenants
      for (const tenantId of allTenants) {
const result = await this.processTenantReminders(tenantId, nextMonth, endOfNextMonth);
        
        totalResult.renewals.push(...result.renewals);
        totalResult.emailsSent += result.emailsSent;
        totalResult.emailResults.push(...(result.emailResults || []));
        totalResult.ownerSummaries.push(...(result.ownerSummaries || []));
        
        // Send admin summary email PER TENANT (not combined)
        if (result.ownerSummaries && result.ownerSummaries.length > 0) {
          await this.sendAdminSummaryEmailForTenant(tenantId, result.ownerSummaries, nextMonth);
        }
      }
return {
        success: true,
        message: 'Monthly reminders processed successfully',
        data: totalResult
      };
    } catch (error: any) {
      console.error('Error in monthly reminder process:', error);
      return {
        success: false,
        message: `Error processing monthly reminders: ${error.message}`
      };
    }
  }

  private async getAllTenantIds(): Promise<string[]> {
    try {
      // Dynamically fetch all unique tenant IDs from subscriptions collection
      const db = await this.storage['getDb']();
      const tenants = await db.collection('subscriptions')
        .distinct('tenantId', { isActive: true });
      
      console.log(`Found ${tenants.length} active tenants: ${tenants.join(', ')}`);
      return tenants.filter((t: any) => t); // Filter out null/undefined
    } catch (error) {
      console.error('Error fetching tenant IDs:', error);
      // Fallback to known tenant if dynamic fetch fails
      return ['tenant-3ylxgng5x-1755678829258'];
    }
  }

  private async processTenantReminders(tenantId: string, startDate: Date, endDate: Date): Promise<any> {
    try {
// Get all subscriptions for this tenant that renew next month
      const subscriptions = await this.storage.getSubscriptions(tenantId);
if (subscriptions.length > 0) {
subscriptions.forEach((sub: any, index: number) => {
          console.log(`  ${index + 1}. ${sub.serviceName} - Next Renewal: ${sub.nextRenewal} (${new Date(sub.nextRenewal).toLocaleDateString()})`);
        });
      }
      
      const nextMonthRenewals = subscriptions.filter((sub: any) => {
        if (!sub.nextRenewal) {
return false;
        }
        const renewalDate = new Date(sub.nextRenewal);
        const inRange = renewalDate >= startDate && renewalDate <= endDate;
        console.log(`  ${sub.serviceName}: ${renewalDate.toLocaleDateString()} - ${inRange ? 'INCLUDED' : 'excluded'} (range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()})`);
        return inRange;
      });
if (nextMonthRenewals.length === 0) {
return { renewals: [], emailsSent: 0 };
      }
// Group subscriptions by owner (pass tenantId for proper lookup)
      const subscriptionsByOwner = await this.groupSubscriptionsByOwner(nextMonthRenewals, tenantId);

      const emailResults = [];
      const owners = Array.from(subscriptionsByOwner.entries());
      
      for (const [ownerEmail, ownerSubscriptions] of owners) {
        if (!ownerEmail || !this.isValidEmail(ownerEmail)) {
continue;
        }

        const emailResult = await this.prepareReminderEmail(ownerEmail, ownerSubscriptions, startDate);
        emailResults.push(emailResult);
      }

      // Create monthly reminder records for tracking
      await this.createMonthlyReminderRecords(tenantId, nextMonthRenewals);

      // Create owner summaries for admin email
      const ownerSummaries = [];
      const ownerEntries = Array.from(subscriptionsByOwner.entries());
      
      for (const [ownerEmail, ownerSubscriptions] of ownerEntries) {
        const ownerName = ownerSubscriptions[0]?.owner || this.extractNameFromEmail(ownerEmail);
        
        ownerSummaries.push({
          ownerEmail,
          ownerName,
          subscriptions: ownerSubscriptions
        });
      }

      return {
        renewals: nextMonthRenewals,
        emailsSent: emailResults.length,
        emailResults,
        ownerSummaries
      };

    } catch (error) {
      console.error(`Error processing reminders for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  private async groupSubscriptionsByOwner(subscriptions: any[], tenantId: string): Promise<Map<string, any[]>> {
    const grouped = new Map<string, any[]>();
    
    for (const subscription of subscriptions) {
      // Try to get owner email
      let ownerEmail = '';
      // Prefer explicit ownerEmail if present
      if (subscription.ownerEmail && this.isValidEmail(subscription.ownerEmail)) {
        ownerEmail = subscription.ownerEmail;
      }
      
      if (!ownerEmail && subscription.owner) {
        // If owner is an email address, use it directly
        if (this.isValidEmail(subscription.owner)) {
          ownerEmail = subscription.owner;
        } else {
          // If owner is a name, lookup email from employees in the same tenant
          ownerEmail = await this.getEmployeeEmailByName(subscription.owner, tenantId);
}
      }
      
      // Skip if no owner email found
      if (!ownerEmail) {
        console.log(`No owner email found for subscription: ${subscription.serviceName} (owner: ${subscription.owner})`);
        continue;
      }
      
      if (!grouped.has(ownerEmail)) {
        grouped.set(ownerEmail, []);
      }
      grouped.get(ownerEmail)!.push(subscription);
    }
    
    return grouped;
  }

  private async getEmployeeEmailByName(employeeName: string, tenantId?: string): Promise<string> {
    try {
      // Get employees from the database for the specific tenant
if (!tenantId) {
return '';
      }
      
      let employees = await this.storage.getUsers(tenantId);
// Log all employees for debugging
      employees.forEach((emp: any) => {
});
      
      // Find employee by name (case-insensitive)
      const employee = employees.find((emp: any) => 
        emp.name && emp.name.toLowerCase().trim() === employeeName.toLowerCase().trim()
      );
      
      if (employee && employee.email) {
return employee.email;
      }
return '';
    } catch (error) {
      console.error(`Error looking up employee email for "${employeeName}":`, error);
      return '';
    }
  }

  private async prepareReminderEmail(ownerEmail: string, subscriptions: any[], nextMonth: Date): Promise<any> {
    try {
      // Get actual owner name from subscription data, or extract from email
      const ownerName = subscriptions[0]?.owner || this.extractNameFromEmail(ownerEmail);
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
          category: sub.category,
          departments: sub.departments || []
        })),
        totalAmount: subscriptions.reduce((total, sub) => total + (parseFloat(sub.amount || 0)), 0),
        totalCount: subscriptions.length
      };

      // Send actual email using email service
console.log(`Subscriptions (${emailData.totalCount}):`);
      
      emailData.subscriptions.forEach((sub, index) => {
        console.log(`  ${index + 1}. ${sub.serviceName} - ${sub.currency} ${sub.amount} (${new Date(sub.nextRenewal).toLocaleDateString()})`);
      });
      
      console.log(`Total Estimated Amount: ${emailData.subscriptions[0]?.currency || 'USD'} ${emailData.totalAmount.toFixed(2)}`);

      // Generate HTML email content
      const htmlContent = emailService.generateReminderEmailHTML(
        emailData.subscriptions,
        ownerName,
        monthName
      );

      // Send the actual email
      const emailSent = await emailService.sendEmail({
        to: ownerEmail,
        subject: `📅 Subscription Renewals for ${monthName}`,
        html: htmlContent
      });

      if (emailSent) {
} else {
}

      return {
        success: true,
        ownerEmail,
        subscriptionCount: emailData.totalCount,
        totalAmount: emailData.totalAmount,
        emailData,
        emailSent: emailSent
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
          alertDays: 30, // Sent ~30 days before (since we send on 13th for next month)
          emailEnabled: true,
          whatsappEnabled: false,
          reminderType: 'monthly_recurring',
          monthlyDay: 13
        };

        await this.storage.createReminder(reminderData, tenantId);
      }
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
   * Send admin summary email with owner reminders for a specific tenant
   */
  private async sendAdminSummaryEmailForTenant(tenantId: string, ownerSummaries: any[], nextMonth: Date): Promise<void> {
    try {
      if (ownerSummaries.length === 0) {
return;
      }

      // Get admin users from THIS TENANT ONLY
      const adminEmails = await this.getAdminEmailsForTenant(tenantId);
      
      if (adminEmails.length === 0) {
return;
      }

      const monthName = nextMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const totalCount = ownerSummaries.reduce((sum, owner) => sum + owner.subscriptions.length, 0);
console.log(`Admin emails: ${adminEmails.join(', ')}`);
// Generate HTML email content for admin
      const htmlContent = emailService.generateAdminSummaryEmailHTML(
        ownerSummaries,
        totalCount,
        monthName
      );

      // Send email to all admins in this tenant
      let successCount = 0;
      for (const adminEmail of adminEmails) {
        const emailSent = await emailService.sendEmail({
          to: adminEmail,
          subject: `📊 Admin Summary - ${totalCount} Subscriptions Renewing in ${monthName}`,
          html: htmlContent
        });

        if (emailSent) {
successCount++;
        } else {
}
      }
} catch (error: any) {
      console.error(`Error sending admin summary email for tenant ${tenantId}:`, error);
    }
  }

  /**
   * Get admin user emails for a specific tenant
   */
  private async getAdminEmailsForTenant(tenantId: string): Promise<string[]> {
    try {
      const adminEmails: string[] = [];
      
      // Fetch admin users from this tenant only
      const users = await this.storage.getUsers(tenantId);
      
      // Filter users with admin role
      const adminUsers = users.filter((user: any) => 
        user.role === 'admin' && user.email && this.isValidEmail(user.email)
      );
      
      // Add their emails to the list
      adminUsers.forEach((user: any) => {
        if (!adminEmails.includes(user.email)) {
          adminEmails.push(user.email);
        }
      });
      
      return adminEmails;
    } catch (error) {
      console.error(`Error getting admin emails for tenant ${tenantId}:`, error);
      return [];
    }
  }

  /**
   * Check if today is the 13th and run reminders if so
   */
  async checkAndRunDailyReminders(): Promise<{ shouldRun: boolean; result?: any }> {
    const today = new Date();
    const dayOfMonth = today.getDate();
    
    if (dayOfMonth === 13) {
const result = await this.sendMonthlyReminders();
      return { shouldRun: true, result };
    } else {
return { shouldRun: false };
    }
  }

  /**
   * Manual trigger for testing or admin use
   * @param specificTenantId - Optional: only process reminders for this tenant
   */
  async triggerManualReminders(specificTenantId?: string): Promise<any> {
    console.log('Manually triggering monthly reminders (ignoring date)');
    if (specificTenantId) {
}
    
    // Add debug information to the response
    const debugInfo = {
      currentDate: new Date().toISOString(),
      specificTenant: specificTenantId || 'all tenants',
      dateRange: {
        nextMonthStart: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
        nextMonthEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0).toISOString()
      }
    };
    
    const result = await this.sendMonthlyReminders(specificTenantId);
    
    // Add debug info to result
    return {
      ...result,
      debugInfo
    };
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