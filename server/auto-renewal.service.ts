// Auto-renewal service for automatically renewing subscriptions when Next Payment Date = Today
// This service runs daily to check and renew subscriptions with auto-renewal enabled

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
      
      // Filter subscriptions that need renewal today
      const subscriptionsToRenew = subscriptions.filter((sub: any) => {
        if (!sub.autoRenewal) return false;
        if (!sub.nextRenewal) return false;
        
        const nextRenewalDate = new Date(sub.nextRenewal).toISOString().split('T')[0];
        return nextRenewalDate === todayStr;
      });
      
      if (subscriptionsToRenew.length === 0) {
        console.log(`[Auto-Renewal] No renewals needed for tenant ${tenantId}`);
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
      const newStartDate = todayStr;
      const newEndDate = this.calculateEndDate(newStartDate, subscription.billingCycle);
      
      console.log(`[Auto-Renewal] Renewing ${subscription.serviceName}: ${newStartDate} to ${newEndDate}`);
      
      // Update subscription with new dates
      const updateData = {
        startDate: new Date(newStartDate),
        nextRenewal: new Date(newEndDate),
        updatedAt: new Date()
      };
      
      await this.storage.updateSubscription(subscriptionId, updateData, tenantId);
      
      // Create history record
      const historyData = {
        subscriptionId: subscriptionId,
        serviceName: subscription.serviceName,
        vendor: subscription.vendor || '',
        owner: subscription.owner || '',
        action: 'Auto Renewal',
        oldStartDate: oldStartDate,
        oldEndDate: oldEndDate,
        newStartDate: newStartDate,
        newEndDate: newEndDate,
        amount: subscription.amount || 0,
        totalAmount: subscription.totalAmount || 0,
        qty: subscription.qty || 1,
        currency: subscription.currency || '',
        changedBy: 'System',
        timestamp: new Date().toISOString(),
        notes: `Auto-renewal triggered on ${todayStr}`,
        tenantId: tenantId
      };
      
      await this.createHistoryRecord(historyData);
      
      return {
        success: true,
        data: {
          subscriptionId,
          serviceName: subscription.serviceName,
          oldStartDate,
          oldEndDate,
          newStartDate,
          newEndDate
        }
      };
    } catch (error: any) {
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
