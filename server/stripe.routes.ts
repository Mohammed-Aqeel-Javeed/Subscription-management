import StripeLib from "stripe";
import type { Stripe } from "stripe/cjs/stripe.core.js";
import { ObjectId } from "mongodb";
import type { Express, Request, Response } from "express";

// @ts-ignore — CJS types expose a function constructor, but `new` works at runtime
const stripe = new StripeLib(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20" as any,
}) as unknown as Stripe;

const PRICE_IDS: Record<string, string> = {
  starter:      process.env.STRIPE_STARTER_PRICE_ID      || "",
  professional: process.env.STRIPE_PROFESSIONAL_PRICE_ID || "",
};

// Helper: fetch subscription period end from Stripe and apply to user document
async function applySubscriptionPeriodEnd(
  db: any,
  stripeSubscriptionId: string,
  userQuery: Record<string, any>
) {
  try {
    const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const periodEnd = new Date((sub as any).current_period_end * 1000);
    const update = { $set: { subscriptionCurrentPeriodEnd: periodEnd } };
    await db.collection("login").updateMany(userQuery, update);
    await db.collection("signup").updateMany(userQuery, update);
  } catch (err) {
    console.error("[Stripe] Failed to fetch subscription period end:", err);
  }
}

export function registerStripeRoutes(app: Express, connectToDatabase: () => Promise<any>) {

  // ===== Create Checkout Session =====
  app.post("/api/stripe/checkout-session", async (req: Request, res: Response) => {
    try {
      const { plan, mode, userId } = req.body;

      if (!plan || !PRICE_IDS[plan]) {
        return res.status(400).json({ message: "Invalid plan. Must be 'starter' or 'professional'." });
      }

      const priceId = PRICE_IDS[plan];
      if (!priceId) {
        return res.status(500).json({ message: `Price ID not configured for plan: ${plan}` });
      }

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

      const successUrl =
        mode === "upgrade"
          ? `${frontendUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`
          : `${frontendUrl}/signup?session_id={CHECKOUT_SESSION_ID}&plan=${plan}`;

      const cancelUrl =
        mode === "upgrade"
          ? `${frontendUrl}/upgrade`
          : `${frontendUrl}/#pricing`;

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        allow_promotion_codes: true,
        metadata: {
          plan,
          mode: mode || "landing",
          userId: userId || "",
        },
      });

      res.status(200).json({ url: session.url });
    } catch (err: any) {
      console.error("[Stripe] checkout-session error:", err.message);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  // ===== Stripe Webhook =====
  app.post("/api/stripe/webhook", async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"] as string;

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET not set");
      return res.status(500).json({ message: "Webhook secret not configured" });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err: any) {
      console.error("[Stripe Webhook] Signature verification failed:", err.message);
      return res.status(400).send(`Webhook signature mismatch: ${err.message}`);
    }

    const db = await connectToDatabase();

    // ── checkout.session.completed ─────────────────────────────────────────
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const plan                  = session.metadata?.plan as string;
      const mode                  = session.metadata?.mode as string;
      const userId                = session.metadata?.userId as string;
      const customerEmail         = session.customer_details?.email || "";
      const stripeCustomerId      = session.customer as string;
      const stripeSubscriptionId  = session.subscription as string;
      const paidAt                = new Date(session.created * 1000);

      console.log(`[Stripe Webhook] checkout.session.completed — plan=${plan}, mode=${mode}, userId=${userId}`);

      if (mode === "upgrade" && userId) {
        try {
          const userObjectId = new ObjectId(userId);
          const update = {
            $set: {
              plan,
              planActivatedAt: paidAt,
              planExpiredAt: null,
              stripeCustomerId,
              stripeSubscriptionId,
              trialEndsAt: null,
            },
          };
          await db.collection("login").updateOne({ _id: userObjectId }, update);
          await db.collection("signup").updateOne({ _id: userObjectId }, update);
          console.log(`[Stripe Webhook] Plan updated to '${plan}' for userId=${userId}`);

          // Fetch and store subscription period end so profile can show renewal date
          await applySubscriptionPeriodEnd(db, stripeSubscriptionId, { _id: userObjectId });
        } catch (err) {
          console.error("[Stripe Webhook] Failed to update user plan:", err);
        }
      } else {
        // Landing page purchase — store for signup to pick up
        try {
          // Address race condition: maybe user already completed signup?
          const existingUser = await db.collection("login").findOne({ email: customerEmail });
          if (existingUser && customerEmail) {
            console.log(`[Stripe Webhook] Found existing user for landing purchase email: ${customerEmail}`);
            const update = {
              $set: {
                plan,
                planActivatedAt: paidAt,
                planExpiredAt: null,
                stripeCustomerId,
                stripeSubscriptionId,
                trialEndsAt: null,
              },
            };
            await db.collection("login").updateOne({ _id: existingUser._id }, update);
            await db.collection("signup").updateOne({ _id: existingUser._id }, update);
            await applySubscriptionPeriodEnd(db, stripeSubscriptionId, { _id: existingUser._id });
          } else {
            console.log(`[Stripe Webhook] Storing pending purchase for sessionId: ${session.id}`);
            await db.collection("pending_purchases").insertOne({
              sessionId: session.id,
              plan,
              customerEmail,
              stripeCustomerId,
              stripeSubscriptionId,
              amount: session.amount_total,
              currency: session.currency,
              paidAt,
              linkedAt: null,
              linkedEmail: null,
              createdAt: new Date(),
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            });
          }
        } catch (err: any) {
          if (err.code !== 11000) {
            console.error("[Stripe Webhook] Failed to store pending_purchase:", err);
          }
        }
      }
    }

    // ── invoice.payment_succeeded ─────────────────────────────────────────
    // Fires on every successful billing cycle renewal. Update the period end.
    else if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;
      const stripeCustomerId     = invoice.customer as string;
      const stripeSubscriptionId = (invoice as any).subscription as string;
      if (stripeCustomerId && stripeSubscriptionId) {
        console.log(`[Stripe Webhook] invoice.payment_succeeded — customer=${stripeCustomerId}`);
        await applySubscriptionPeriodEnd(db, stripeSubscriptionId, { stripeCustomerId });
        // Ensure plan is marked active in case it was previously expired
        await db.collection("login").updateMany(
          { stripeCustomerId },
          { $set: { planExpiredAt: null } }
        );
        await db.collection("signup").updateMany(
          { stripeCustomerId },
          { $set: { planExpiredAt: null } }
        );
      }
    }

    // ── customer.subscription.deleted ─────────────────────────────────────
    // Fires when a subscription is fully cancelled (not just scheduled for cancellation).
    else if (event.type === "customer.subscription.deleted") {
      const subscription     = event.data.object as Stripe.Subscription;
      const stripeCustomerId = subscription.customer as string;
      console.log(`[Stripe Webhook] customer.subscription.deleted — customer=${stripeCustomerId}`);

      const expiredAt = new Date();
      const update = {
        $set: {
          plan: "expired",
          planExpiredAt: expiredAt,
          subscriptionCurrentPeriodEnd: null,
        },
      };
      await db.collection("login").updateMany({ stripeCustomerId }, update);
      await db.collection("signup").updateMany({ stripeCustomerId }, update);
    }

    // ── invoice.payment_failed ────────────────────────────────────────────
    // Fires when a renewal payment fails. Mark plan as expired after Stripe exhausts retries.
    else if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      // Only expire if this is a final failure (next_payment_attempt is null = retries exhausted)
      if ((invoice as any).next_payment_attempt === null) {
        const stripeCustomerId = invoice.customer as string;
        console.log(`[Stripe Webhook] invoice.payment_failed (final) — customer=${stripeCustomerId}`);
        const update = {
          $set: {
            plan: "expired",
            planExpiredAt: new Date(),
            subscriptionCurrentPeriodEnd: null,
          },
        };
        await db.collection("login").updateMany({ stripeCustomerId }, update);
        await db.collection("signup").updateMany({ stripeCustomerId }, update);
      }
    }

    res.status(200).json({ received: true });
  });

  // ===== Verify Checkout Session =====
  app.get("/api/stripe/verify-session", async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.query as { sessionId: string };
      if (!sessionId) {
        return res.status(400).json({ message: "Missing sessionId" });
      }

      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status !== "paid" && session.status !== "complete") {
        return res.status(402).json({ message: "Payment not completed" });
      }

      // Proactive Fallback: If user is authenticated, apply the plan immediately.
      // This prevents the UI from saying "success" before the database is updated,
      // and acts as a failsafe if webhooks are delayed or not forwarded locally.
      const user = (req as any).user;
      if (user && user.userId) {
        const plan = session.metadata?.plan;
        if (plan) {
          const db = await connectToDatabase();
          const userObjectId = new ObjectId(user.userId);
          const paidAt = new Date(session.created * 1000);
          
          const update = {
            $set: {
              plan,
              planActivatedAt: paidAt,
              planExpiredAt: null,
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
              trialEndsAt: null,
            },
          };
          
          await db.collection("login").updateOne({ _id: userObjectId }, update);
          await db.collection("signup").updateOne({ _id: userObjectId }, update);

          // Fetch and store the subscription period end so the profile countdown works
          const stripeSubId = session.subscription as string;
          if (stripeSubId) {
            await applySubscriptionPeriodEnd(db, stripeSubId, { _id: userObjectId });
          }
        }
      }

      res.status(200).json({
        plan: session.metadata?.plan || null,
        paid: true,
        status: session.status,
      });
    } catch (err: any) {
      console.error("[Stripe] verify-session error:", err.message);
      res.status(500).json({ message: "Failed to verify session" });
    }
  });
}
