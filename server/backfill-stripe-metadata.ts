import StripeLib from "stripe";
import type { Stripe } from "stripe/cjs/stripe.core.js";
import { connectToDatabase } from "./mongo.js";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const StripeCtor: any = StripeLib as any;
const stripe: Stripe | null = STRIPE_SECRET_KEY
  ? (new StripeCtor(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" as any }) as Stripe)
  : null;

function cleanMetadata(metadata: Record<string, unknown>) {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const v = String(value ?? "").trim();
    if (!v) continue;
    clean[key] = v;
  }
  return clean;
}

async function main() {
  if (!stripe) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  const db = await connectToDatabase();

  const rows = await db
    .collection("login")
    .find(
      {
        role: { $ne: "global_admin" },
        stripeCustomerId: { $exists: true, $nin: [null, ""] },
      },
      {
        projection: {
          email: 1,
          tenantId: 1,
          companyName: 1,
          plan: 1,
          stripeCustomerId: 1,
          stripeSubscriptionId: 1,
        },
      }
    )
    .limit(5000)
    .toArray();

  const tenantIds = Array.from(
    new Set(
      rows
        .map((row: any) => (row?.tenantId ? String(row.tenantId) : ""))
        .filter(Boolean)
    )
  );
  const companyInfoRows = await db
    .collection("companyInfo")
    .find({ tenantId: { $in: tenantIds } }, { projection: { tenantId: 1, companyName: 1 } })
    .toArray();
  const companyInfoMap = new Map(
    (companyInfoRows as any[]).map((row: any) => [String(row?.tenantId || ""), String(row?.companyName || "")])
  );

  let customerUpdated = 0;
  let subscriptionUpdated = 0;
  let failed = 0;

  for (const row of rows as any[]) {
    const stripeCustomerId = String(row?.stripeCustomerId || "").trim();
    const stripeSubscriptionId = String(row?.stripeSubscriptionId || "").trim();

    if (!stripeCustomerId) continue;

    const tenantId = row?.tenantId ? String(row.tenantId) : "";
    const companyName = companyInfoMap.get(tenantId) || (row?.companyName ? String(row.companyName) : "");

    const metadata = cleanMetadata({
      tenantId,
      companyName,
      userEmail: row?.email ? String(row.email) : "",
      plan: row?.plan ? String(row.plan) : "",
    });

    if (!Object.keys(metadata).length) continue;

    try {
      await stripe.customers.update(stripeCustomerId, { metadata } as any);
      customerUpdated += 1;

      if (stripeSubscriptionId) {
        await stripe.subscriptions.update(stripeSubscriptionId, { metadata } as any);
        subscriptionUpdated += 1;
      }
    } catch (e) {
      failed += 1;
      // Keep going; some IDs may be deleted in Stripe.
      console.warn("[Backfill] Failed for customer/subscription:", {
        stripeCustomerId,
        stripeSubscriptionId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  console.log("[Backfill] Done", {
    scanned: rows.length,
    customerUpdated,
    subscriptionUpdated,
    failed,
  });
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
