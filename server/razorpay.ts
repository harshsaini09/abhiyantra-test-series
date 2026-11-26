import { Router, Request, Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { prisma, isDbConfigured } from './db.js';
import { AuthenticatedRequest, verifyUserToken } from './auth.js';

const router = Router();

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

// Initialize Razorpay client
export const getRazorpayClient = (): Razorpay => {
  return new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });
};

// Helper to ensure a user exists and activate their subscription
async function ensureUserAndActivateSub(
  email: string,
  name?: string,
  planId = 'gate-complete-pass'
): Promise<string | null> {
  if (!isDbConfigured || !prisma || !email) return null;

  const normalizedEmail = email.toLowerCase().trim();
  const userName = name || normalizedEmail.split('@')[0];
  const expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        googleId: `google_pending_${normalizedEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
        email: normalizedEmail,
        name: userName,
        role: 'STUDENT',
        isSubscribed: true,
        subscriptionTier: planId,
        subscriptionUntil: expiryDate,
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        isSubscribed: true,
        subscriptionTier: planId,
        subscriptionUntil: expiryDate,
      },
    });
  }

  return user.id;
}

// ─── 1. Create Razorpay Order (POST /api/create-order) ───
export async function handleCreateOrder(req: Request, res: Response): Promise<void> {
  try {
    const { amount, currency = 'INR', receipt, notes } = req.body;

    // Validate amount
    const parsedAmount = Math.round(Number(amount));
    if (isNaN(parsedAmount) || parsedAmount < 100) {
      res.status(400).json({
        error: 'Invalid amount. Minimum amount must be at least 100 paise (₹1).',
      });
      return;
    }

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      res.status(500).json({
        error: 'Razorpay credentials not configured on server.',
      });
      return;
    }

    const razorpay = getRazorpayClient();
    const orderOptions = {
      amount: parsedAmount,
      currency: currency.toUpperCase(),
      receipt: receipt || `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      notes: notes || {},
    };

    const order = await razorpay.orders.create(orderOptions);

    res.status(200).json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: RAZORPAY_KEY_ID,
    });
  } catch (error: any) {
    console.error('Razorpay create-order error:', error);
    res.status(500).json({
      error: error?.message || 'Failed to create Razorpay order.',
    });
  }
}

// ─── 2. Verify Razorpay Signature (POST /api/verify-payment) ───
export async function handleVerifyPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planId = 'gate-complete-pass',
      planName = 'GATE Complete Mock Test Series (2026/2027)',
      amount = 59,
      userEmail,
      userName,
    } = req.body;

    // Check missing required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400).json({
        error: 'Missing required Razorpay fields: razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.',
      });
      return;
    }

    if (!RAZORPAY_KEY_SECRET) {
      res.status(500).json({ error: 'Server configuration error: Razorpay secret key missing.' });
      return;
    }

    // Compute expected HMAC SHA-256 signature
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generated_signature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(text)
      .digest('hex');

    // Compare generated signature with razorpay_signature
    if (generated_signature !== razorpay_signature) {
      res.status(400).json({
        success: false,
        error: 'Payment verification failed: signature mismatch.',
      });
      return;
    }

    // Resolve authenticated user if session exists
    let userId = req.user?.id;
    if (!userId) {
      const token = req.cookies?.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
      if (token) {
        const decoded = verifyUserToken(token);
        if (decoded?.id) userId = decoded.id;
      }
    }

    // If userId not found from token, resolve/create via userEmail or Razorpay payment details
    if (!userId && isDbConfigured && prisma) {
      let resolvedEmail = userEmail;
      let resolvedName = userName;

      // If email wasn't passed in body, fetch from Razorpay API
      if (!resolvedEmail && RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
        try {
          const razorpay = getRazorpayClient();
          const pDetails: any = await razorpay.payments.fetch(razorpay_payment_id);
          resolvedEmail = pDetails.email || pDetails.notes?.userEmail;
          resolvedName = pDetails.notes?.userName || resolvedEmail?.split('@')[0];
        } catch (fetchErr) {
          console.warn('Could not fetch payment email from Razorpay:', fetchErr);
        }
      }

      if (resolvedEmail) {
        userId = await ensureUserAndActivateSub(resolvedEmail, resolvedName, planId) || undefined;
      }
    }

    // Update database records if connected
    if (isDbConfigured && prisma && userId) {
      try {
        const expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

        // Record verified payment
        await prisma.paymentRecord.upsert({
          where: { utrNumber: razorpay_payment_id },
          update: {
            status: 'VERIFIED',
            verifiedAt: new Date(),
          },
          create: {
            userId,
            planId,
            planName,
            amount: Number(amount) || 59,
            utrNumber: razorpay_payment_id,
            upiIdUsed: 'Razorpay Live Checkout',
            status: 'VERIFIED',
            verifiedAt: new Date(),
            adminNote: `Order: ${razorpay_order_id}`,
          },
        });

        // Activate Pro Pass for user
        await prisma.user.update({
          where: { id: userId },
          data: {
            isSubscribed: true,
            subscriptionTier: planId,
            subscriptionUntil: expiryDate,
          },
        });
      } catch (dbErr) {
        console.warn('Database update after Razorpay verification notice:', dbErr);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully. Subscription activated.',
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id,
    });
  } catch (error: any) {
    console.error('Razorpay verify-payment error:', error);
    res.status(500).json({
      error: error?.message || 'Internal server error verifying payment.',
    });
  }
}

// ─── 3. Sync Captured Payments Directly from Razorpay API (POST /api/razorpay/sync) ───
export async function handleSyncRazorpay(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // Authenticate Master Admin
    const token = req.cookies?.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
    const authUser = token ? verifyUserToken(token) : null;
    const isMasterAdmin = authUser && (
      authUser.role === 'ADMIN' ||
      ['harshsaini0912@gmail.com', 'harshsaini0912@gmail'].includes(authUser.email.toLowerCase().trim()) ||
      authUser.email.toLowerCase().startsWith('harshsaini0912@')
    );

    if (authUser && !isMasterAdmin) {
      res.status(403).json({ error: 'Access denied: Master Admin permission required.' });
      return;
    }

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      res.status(500).json({ error: 'Razorpay API credentials missing.' });
      return;
    }

    if (!isDbConfigured || !prisma) {
      res.status(500).json({ error: 'Database not connected.' });
      return;
    }

    const razorpay = getRazorpayClient();
    const paymentsList: any = await razorpay.payments.all({ count: 50 });
    const items = paymentsList?.items || [];

    let syncedCount = 0;
    const syncedPayments: string[] = [];

    for (const p of items) {
      // Only process captured payments
      if (p.status !== 'captured') continue;

      const paymentId = p.id;
      const email = (p.email || p.notes?.userEmail || '').toLowerCase().trim();
      const name = p.notes?.userName || (email ? email.split('@')[0] : 'Student');
      const amount = (p.amount || 5900) / 100;
      const planId = p.notes?.planId || 'gate-complete-pass';
      const planName = p.notes?.planName || 'GATE Complete Mock Test Series (2026/2027)';

      // Check if already in PaymentRecord
      const existing = await prisma.paymentRecord.findUnique({
        where: { utrNumber: paymentId },
      });

      if (!existing && email) {
        // Ensure user exists and is subscribed
        const userId = await ensureUserAndActivateSub(email, name, planId);

        if (userId) {
          await prisma.paymentRecord.create({
            data: {
              userId,
              planId,
              planName,
              amount,
              utrNumber: paymentId,
              upiIdUsed: 'Razorpay Live Checkout',
              status: 'VERIFIED',
              verifiedAt: new Date((p.created_at || Date.now() / 1000) * 1000),
              adminNote: `Order: ${p.order_id || 'N/A'} (Auto-Synced)`,
            },
          });

          syncedCount++;
          syncedPayments.push(paymentId);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Successfully synchronized Razorpay payments.`,
      syncedCount,
      totalChecked: items.length,
      syncedPayments,
    });
  } catch (error: any) {
    console.error('Razorpay sync error:', error);
    res.status(500).json({ error: error?.message || 'Failed to sync Razorpay payments.' });
  }
}

// ─── 4. Razorpay Webhook Handler (POST /api/razorpay/webhook) ───
export async function handleRazorpayWebhook(req: Request, res: Response): Promise<void> {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || RAZORPAY_KEY_SECRET;
    const signature = req.headers['x-razorpay-signature'] as string;

    // Verify webhook signature if provided
    if (signature && secret) {
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
      if (signature !== expectedSignature) {
        console.warn('Webhook signature mismatch.');
      }
    }

    const event = req.body?.event;
    const payment = req.body?.payload?.payment?.entity;

    if (payment && (event === 'payment.captured' || event === 'order.paid' || payment.status === 'captured')) {
      const paymentId = payment.id;
      const email = (payment.email || payment.notes?.userEmail || '').toLowerCase().trim();
      const name = payment.notes?.userName || (email ? email.split('@')[0] : 'Student');
      const amount = (payment.amount || 5900) / 100;
      const planId = payment.notes?.planId || 'gate-complete-pass';
      const planName = payment.notes?.planName || 'GATE Complete Mock Test Series (2026/2027)';

      if (email && isDbConfigured && prisma) {
        const userId = await ensureUserAndActivateSub(email, name, planId);
        if (userId) {
          await prisma.paymentRecord.upsert({
            where: { utrNumber: paymentId },
            update: {
              status: 'VERIFIED',
              verifiedAt: new Date(),
            },
            create: {
              userId,
              planId,
              planName,
              amount,
              utrNumber: paymentId,
              upiIdUsed: 'Razorpay Live Checkout',
              status: 'VERIFIED',
              verifiedAt: new Date(),
              adminNote: `Order: ${payment.order_id || 'N/A'} (Webhook)`,
            },
          });
        }
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (error: any) {
    console.error('Razorpay webhook error:', error);
    res.status(200).json({ status: 'ok' }); // Always return 200 to Razorpay
  }
}

// Routes
router.post('/create-order', handleCreateOrder);
router.post('/verify-payment', handleVerifyPayment);
router.post('/razorpay/sync', handleSyncRazorpay);
router.post('/razorpay/webhook', handleRazorpayWebhook);

export default router;
