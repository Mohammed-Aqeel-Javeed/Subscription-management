/**
 * Calculate subscription status based on expiry date and reminder days
 * @param nextRenewal - The subscription's next renewal/expiry date
 * @param reminderDays - Number of days before expiry to show "Expiring Soon"
 * @param currentStatus - The current stored status (for Cancelled/Draft subscriptions)
 * @returns The calculated status: 'Active' | 'Expiring Soon' | 'Expired' | 'Cancelled' | 'Draft'
 */
export function calculateSubscriptionStatus(
  nextRenewal: string | Date | null | undefined,
  reminderDays: number | string | null | undefined,
  currentStatus?: string | null
): string {
  // If status is Cancelled or Draft, return as-is
  const status = String(currentStatus || '').trim();
  if (status === 'Cancelled' || status === 'Draft') {
    return status;
  }

  // If no renewal date, default to Active
  if (!nextRenewal) {
    return 'Active';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const renewalDate = new Date(nextRenewal);
  renewalDate.setHours(0, 0, 0, 0);

  // Calculate days until expiry
  const daysUntilExpiry = Math.ceil((renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // If date has passed, it's expired
  if (daysUntilExpiry < 0) {
    return 'Expired';
  }

  // If within reminder days threshold, it's expiring soon
  const reminderThreshold = Number(reminderDays) || 7; // Default to 7 days
  if (daysUntilExpiry <= reminderThreshold) {
    return 'Expiring Soon';
  }

  // Otherwise, it's active
  return 'Active';
}

/**
 * Get status badge styling classes
 */
export function getStatusBadgeClass(status: string): string {
  const normalizedStatus = String(status || '').trim();
  
  switch (normalizedStatus) {
    case 'Active':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'Expiring Soon':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'Expired':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'Cancelled':
      return 'bg-gray-50 text-gray-700 border-gray-200';
    case 'Draft':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}

/**
 * Get status badge styling for modal header
 */
export function getStatusModalBadgeClass(status: string): string {
  const normalizedStatus = String(status || '').trim();
  
  switch (normalizedStatus) {
    case 'Active':
      return 'bg-green-500 text-white';
    case 'Expiring Soon':
      return 'bg-orange-500 text-white';
    case 'Expired':
      return 'bg-red-500 text-white';
    case 'Cancelled':
      return 'bg-gray-500 text-white';
    case 'Draft':
      return 'bg-blue-500 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
}

/**
 * Get status priority for sorting (lower number = higher priority)
 */
export function getStatusPriority(status: string): number {
  const normalizedStatus = String(status || '').trim();
  
  switch (normalizedStatus) {
    case 'Active':
      return 1;
    case 'Expiring Soon':
      return 2;
    case 'Expired':
      return 3;
    case 'Cancelled':
      return 4;
    case 'Draft':
      return 5;
    default:
      return 6;
  }
}
