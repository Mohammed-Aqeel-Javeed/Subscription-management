// Auto-renewal service for automatically renewing subscriptions when Next Payment Date = Today
// This service runs daily to check and renew subscriptions with auto-renewal enabled

import { ObjectId } from 'mongodb';

export class AutoRenewalService {
  constructor(private storage: any) {}

  /**
   * Runs daily to check and renew subscriptions where:
   * - Auto Renewal is enabled
   * - Next Payment Date = Today
   */
  async processAutoRenewals(): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      console.log(`[Auto-Renewal] Checking for renewals on ${todayStr}`);
      
      // Get all tenants
      const allTenants = await this.getAllTenantIds();
      console.log(`[Auto-Renewal] Found ${allTenants.length} tenants`);
      
      let totalResult = {
        renewed: [] as any[],
        failed: [] as any[],
        totalRenewed: 0,
        totalFailed: 0
      };
      
      // Process renewals for all tenants
      for (const tenantId of allTenants) {
        const result = await this.processTenantRenewals(tenantId, todayStr);
        
        totalResult.renewed.push(...result.renewed);
        totalResult.failed.push(...result.failed);
        totalResult.totalRenewed += result.renewed.length;
        totalResult.totalFailed += result.failed.length;
      }
      
      console.log(`[Auto-Renewal] Completed: ${totalResult.totalRenewed} renewed, ${totalResult.totalFailed} failed`);
      
      return {
        success: true,
        message: `Auto-renewal completed: ${totalResult.totalRenewed} subscriptions renewed`,
        data: totalResult
      };
    } catch (error: any) {
      console.error('[Auto-Renewal] Error:', error);
      return {
        success: false,
        message: `Error processing auto-renewals: ${error.message}`
      };
    }
  }

  private async getAllTenantIds(): Promise<string[]> {
    try {
      const db = await this.storage['getDb']();
      const tenants = await db.collection('subscriptions')
        .distinct('tenantId', { isActive: true });
      
      return tenants.filter((t: any) => t);
    } catch (error) {
      console.error('[Auto-Renewal] Error fetching tenant IDs:', error);
      return [];
    }
  }

  private async processTenantRenewals(tenantId: string, todayStr: string): Promise<any> {
    try {
      // Get all subscriptions for this tenant
      const subscriptions = await this.storage.getSubscriptions(tenantId);
      
      console.log(`[Auto-Renewal] Tenant ${tenantId}: Found ${subscriptions.length} total subscriptions`);
      
      // Debug: Log subscriptions with auto-renewal enabled
      const autoRenewalSubs = subscriptions.filter((sub: any) => sub.autoRenewal);
      console.log(`[Auto-Renewal] Tenant ${tenantId}: ${autoRenewalSubs.length} subscriptions have auto-renewal enabled`);
      
      if (autoRenewalSubs.length > 0) {
        console.log(`[Auto-Renewal] Auto-renewal subscriptions:`, autoRenewalSubs.map((s: any) => ({
          serviceName: s.serviceName,
          autoRenewal: s.autoRenewal,
          nextRenewal: s.nextRenewal,
          nextRenewalDate: s.nextRenewal ? new Date(s.nextRenewal).toISOString().split('T')[0] : 'N/A',
          todayStr: todayStr
        })));
      }
      
      // Filter subscriptions that need renewal today
      const subscriptionsToRenew = subscriptions.filter((sub: any) => {
        if (!sub.autoRenewal) return false;
        if (!sub.nextRenewal) return false;
        
        const nextRenewalDate = new Date(sub.nextRenewal).toISOString().split('T')[0];
        return nextRenewalDate === todayStr;
      });
      
      if (subscriptionsToRenew.length === 0) {
        console.log(`[Auto-Renewal] No renewals needed for tenant ${tenantId} on ${todayStr}`);
        return { renewed: [], failed: [] };
      }
      
      console.log(`[Auto-Renewal] Found ${subscriptionsToRenew.length} subscriptions to renew for tenant ${tenantId}`);
      
      const renewed = [];
      const failed = [];
      
      for (const subscription of subscriptionsToRenew) {
        try {
          const result = await this.renewSubscription(subscription, tenantId, todayStr);
          if (result.success) {
            renewed.push(result.data);
          } else {
            failed.push({ subscription, error: result.error });
          }
        } catch (error: any) {
          console.error(`[Auto-Renewal] Failed to renew ${subscription.serviceName}:`, error);
          failed.push({ subscription, error: error.message });
        }
      }
      
      return { renewed, failed };
    } catch (error) {
      console.error(`[Auto-Renewal] Error processing tenant ${tenantId}:`, error);
      throw error;
    }
  }

  private async renewSubscription(subscription: any, tenantId: string, todayStr: string): Promise<any> {
    try {
      const subscriptionId = subscription._id || subscription.id;
      
      // Calculate new dates
      const oldStartDate = subscription.startDate;
      const oldEndDate = subscription.nextRenewal;
      const newStartDate = new Date(todayStr);
      const newEndDate = new Date(this.calculateEndDate(todayStr, subscription.billingCycle));
      
      console.log(`[Auto-Renewal] Renewing ${subscription.serviceName}: ${todayStr} to ${newEndDate.toISOString().split('T')[0]}`);
      
      // Parse amounts properly (they might be strings)
      const amount = typeof subscription.amount === 'string' ? parseFloat(subscription.amount) : (subscription.amount || 0);
      const totalAmount = typeof subscription.totalAmount === 'string' ? parseFloat(subscription.totalAmount) : (subscription.totalAmount || 0);
      const qty = typeof subscription.qty === 'string' ? parseInt(subscription.qty) : (subscription.qty || 1);
      const lcyAmount = typeof subscription.lcyAmount === 'string' ? parseFloat(subscription.lcyAmount) : (subscription.lcyAmount || 0);
      
      console.log(`[Auto-Renewal] Subscription amounts - amount: ${amount}, totalAmount: ${totalAmount}, qty: ${qty}, lcyAmount: ${lcyAmount}`);
      
      // Update subscription with new dates
      const updateData = {
        startDate: newStartDate,
        nextRenewal: newEndDate,
        updatedAt: new Date()
      };
      
      await this.storage.updateSubscription(subscriptionId, updateData, tenantId);
      
      // Create history record in the correct format (matching manual renewal format)
      // Ensure subscriptionId is ObjectId for proper querying
      const subIdObj = typeof subscriptionId === 'string' ? new ObjectId(subscriptionId) : subscriptionId;
      
      const historyData = {
        action: 'Renewed',
        subscriptionId: subIdObj,
        tenantId: tenantId,
        timestamp: new Date().toISOString(),
        data: {
          _id: subscriptionId,
          serviceName: subscription.serviceName,
          vendor: subscription.vendor || '',
          owner: subscription.owner || '',
          ownerEmail: subscription.ownerEmail || '',
          ownerName: subscription.ownerName || subscription.owner || '',
          category: subscription.category || '',
          department: subscription.department || subscription.departments || [],
          departments: subscription.departments || [],
          amount: amount,
          totalAmount: totalAmount,
          qty: qty,
          lcyAmount: lcyAmount,
          currency: subscription.currency || '',
          billingCycle: subscription.billingCycle || 'monthly',
          commitmentCycle: subscription.commitmentCycle || '',
          paymentFrequency: subscription.paymentFrequency || '',
          paymentMethod: subscription.paymentMethod || '',
          website: subscription.website || '',
          startDate: newStartDate.toISOString(),
          nextRenewal: newEndDate.toISOString(),
          initialDate: subscription.initialDate || oldStartDate,
          status: subscription.status || 'Active',
          reminderDays: subscription.reminderDays || 7,
          reminderPolicy: subscription.reminderPolicy || 'One time',
          notes: subscription.notes || '',
          isActive: subscription.isActive !== false,
          autoRenewal: subscription.autoRenewal || false
        },
        updatedFields: {
          startDate: newStartDate.toISOString(),
          nextRenewal: newEndDate.toISOString()
        },
        changedBy: 'System (Auto-Renewal)',
        changeReason: `Auto-renewal triggered on ${todayStr}`
      };
      
      console.log(`[Auto-Renewal] Creating history record with totalAmount: ${historyData.data.totalAmount}, lcyAmount: ${historyData.data.lcyAmount}`);
      
      await this.createHistoryRecord(historyData);
      
      return {
        success: true,
        data: {
          subscriptionId,
          serviceName: subscription.serviceName,
          oldStartDate,
          oldEndDate,
          newStartDate: newStartDate.toISOString(),
          newEndDate: newEndDate.toISOString()
        }
      };
    } catch (error: any) {
      console.error(`[Auto-Renewal] Error renewing subscription:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  private calculateEndDate(startDate: string, billingCycle: string): string {
    const date = new Date(startDate);
    let endDate = new Date(date);
    
    switch (billingCycle?.toLowerCase()) {
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(endDate.getDate() - 1);
        break;
      case 'quarterly':
        endDate.setMonth(endDate.getMonth() + 3);
        endDate.setDate(endDate.getDate() - 1);
        break;
      case 'yearly':
        endDate.setFullYear(endDate.getFullYear() + 1);
        endDate.setDate(endDate.getDate() - 1);
        break;
      case 'weekly':
        endDate.setDate(endDate.getDate() + 6);
        break;
      case 'trial':
        endDate.setDate(endDate.getDate() + 30);
        break;
      default:
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(endDate.getDate() - 1);
    }
    
    const yyyy = endDate.getFullYear();
    const mm = String(endDate.getMonth() + 1).padStart(2, '0');
    const dd = String(endDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private async createHistoryRecord(historyData: any): Promise<void> {
    try {
      const db = await this.storage['getDb']();
      await db.collection('history').insertOne({
        ...historyData,
        createdAt: new Date()
      });
    } catch (error) {
      console.error('[Auto-Renewal] Error creating history record:', error);
    }
  }

  /**
   * Manual trigger for testing
   */
  async triggerManualRenewal(): Promise<any> {
    console.log('[Auto-Renewal] Manually triggering auto-renewals');
    return await this.processAutoRenewals();
  }
}

// Create a singleton instance
let autoRenewalService: AutoRenewalService | null = null;

export const getAutoRenewalService = (storage: any): AutoRenewalService => {
  if (!autoRenewalService) {
    autoRenewalService = new AutoRenewalService(storage);
  }
  return autoRenewalService;
};
