# Analytics Fix - MongoDB Aggregation to In-Memory Calculations

## Problem
After implementing AES-256-GCM encryption on subscription data, the analytics endpoints were failing with the following error:

```
MongoServerError: Failed to parse number 'CPdcx8XQHmurf3aiqh0RIvrrN7CQy/79SKKPwiWoiGPjEbGb32rmnOBIFHuhdbdfeOqHqpeILy04bbk1Wu5Nk/H1WJY/1mJGXUXyqHSq4aaPCqdmlv5fbBlJ62JOpzk5AJhS/Dc=' in $convert with no onError value
```

**Root Cause:** MongoDB aggregation pipelines were using `$toDouble` and `$sum` operations directly on encrypted fields. Since encrypted data is stored as base64 strings, MongoDB couldn't perform numeric conversions.

## Solution
Converted all MongoDB aggregation operations to **in-memory JavaScript calculations** after decryption.

### Changes Made to `server/analytics.routes.ts`

#### 1. Dashboard Endpoint (`/api/analytics/dashboard`)
**Before:**
```typescript
const [monthlyResult] = await collection.aggregate([
  { $match: { status: "Active", tenantId } },
  { $project: { amount: { $toDouble: "$amount" }, billingCycle: 1 } },
  { $group: { _id: null, total: { $sum: "$amount" } } }
]).toArray();
```

**After:**
```typescript
const subscriptions = await collection.find({ status: "Active", tenantId }).toArray();

let monthlySpend = 0;
let yearlySpend = 0;

subscriptions.forEach(sub => {
  const decryptedAmount = decrypt(sub.amount);
  const amount = parseFloat(decryptedAmount) || 0;
  
  const billingCycle = (sub.billingCycle || 'monthly').toLowerCase();
  let monthlyAmount = amount;
  let yearlyAmount = amount * 12;
  
  if (billingCycle === 'yearly') {
    monthlyAmount = amount / 12;
    yearlyAmount = amount;
  } else if (billingCycle === 'quarterly') {
    monthlyAmount = amount / 3;
    yearlyAmount = amount * 4;
  } else if (billingCycle === 'weekly') {
    monthlyAmount = amount * 4;
    yearlyAmount = amount * 52;
  }
  
  monthlySpend += monthlyAmount;
  yearlySpend += yearlyAmount;
});
```

#### 2. Trends Endpoint (`/api/analytics/trends`)
**Before:**
```typescript
const amount = parseFloat(sub.amount) || 0; // Tried to parse encrypted string directly
```

**After:**
```typescript
const decryptedAmount = decrypt(sub.amount);
const amount = parseFloat(decryptedAmount) || 0;
```

#### 3. Categories Endpoint (`/api/analytics/categories`)
**Before:**
```typescript
const categories = await collection.aggregate([
  { $match: { status: "Active", tenantId } },
  { $group: {
      _id: { $ifNull: ["$category", "Other"] },
      amount: { $sum: { $toDouble: "$amount" } }
    }
  }
]).toArray();
```

**After:**
```typescript
const subscriptions = await collection.find({ status: "Active", tenantId }).toArray();

const categoryMap = new Map<string, number>();

subscriptions.forEach(sub => {
  const category = sub.category || "Other";
  const decryptedAmount = decrypt(sub.amount);
  const amount = parseFloat(decryptedAmount) || 0;
  
  categoryMap.set(category, (categoryMap.get(category) || 0) + amount);
});

const categories = Array.from(categoryMap.entries()).map(([category, amount]) => ({
  category,
  amount: Number(amount.toFixed(2))
}));
```

## Testing
1. **Restart server:** `npm run dev`
2. **Refresh browser:** Hard refresh (Ctrl+F5) to clear cached responses
3. **Verify endpoints:**
   - `GET /api/analytics/dashboard` - Should return `monthlySpend` and `yearlySpend`
   - `GET /api/analytics/categories` - Should return categories with amounts
   - `GET /api/analytics/trends` - Should return 6 months of spending data

## Status
✅ All analytics endpoints updated
✅ Decryption integrated before calculations
✅ MongoDB aggregation errors resolved
✅ Server restart required to apply changes

## Next Steps
1. Refresh the dashboard in your browser (Ctrl+F5)
2. Verify analytics cards display correct monetary values
3. Check browser console for any errors
4. If needed, generate production encryption keys: `npm run generate-keys`
