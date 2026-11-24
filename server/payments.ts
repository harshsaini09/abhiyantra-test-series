import { Router, Response } from 'express';
import { prisma, isDbConfigured } from './db.js';
import { requireAuth, AuthenticatedRequest } from './auth.js';

const router = Router();

// Master Admin Email
export const ADMIN_EMAIL = 'harshsaini0912@gmail.com';

// Configurable UPI details (0% fee, direct payment to owner)
export const UPI_PAYEE_ID = process.env.UPI_PAYEE_ID || 'harshsaini0912@okhdfcbank';
export const UPI_PAYEE_NAME = process.env.UPI_PAYEE_NAME || 'Abhiyantra Test Series';
export const UPI_QR_IMAGE = '/payment-qr.jpg';

export interface PlanDefinition {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  discountBadge: string;
  durationDays: number;
  popular?: boolean;
  features: string[];
}

export const PLANS: PlanDefinition[] = [
  {
    id: 'gate-complete-pass',
    name: 'GATE Complete Mock Test Series (2026/2027)',
    price: 59,
    originalPrice: 499,
    discountBadge: '88% OFF - Limited Special',
    durationDays: 365,
    popular: true,
    features: [
      'Full 65-Question Authentic GATE CBT Mock Tests',
      'GATE Authentic Marking Scheme (+1, -1/3 & +2, -2/3)',
      'Step-by-Step Solutions with Mathematical Formulations',
      'Mistake Notebook & 1-Click Retest on Missed Questions',
      'AI-Powered Weak Topic Diagnosis & Ranking Insights',
      'Unlimited Retakes on all Mock & Subject Papers',
      'Valid for 1 Full Year (Through GATE 2027)',
    ],
  },
  {
    id: 'gate-booster-pass',
    name: 'Subject & Topic-Wise Booster Pass',
    price: 29,
    originalPrice: 199,
    discountBadge: 'Special Offer',
    durationDays: 180,
    popular: false,
    features: [
      'All Chapter-Wise & Subject-Wise Practice Papers',
      'Custom Test Builder with 100+ Question Pool',
      'Detailed Explanations & Virtual Calculator Practice',
      'Personal Question Bookmarks & Error Notes',
      'Valid for 6 Months',
    ],
  },
];

// Helper: generate unique Order ID
function generateOrderId(planId: string): string {
  const shortPlan = planId.includes('complete') ? 'CMP' : 'BST';
  const timestamp = Date.now().toString().slice(-6);
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ABH_${shortPlan}_${timestamp}_${randomStr}`;
}

// Helper: build standard NPCI UPI Intent URI
export function buildUpiUri(upiId: string, payeeName: string, amount: number, orderId: string, note: string): string {
  const params = new URLSearchParams({
    pa: upiId,
    pn: payeeName,
    am: amount.toFixed(2),
    cu: 'INR',
    tn: note.slice(0, 40),
    tr: orderId,
  });
  return `upi://pay?${params.toString()}`;
}

// ─── 1. Get Available Plans & UPI Config (Public) ───
router.get('/plans', (_req, res: Response) => {
  res.json({
    success: true,
    plans: PLANS,
    upi: {
      payeeId: UPI_PAYEE_ID,
      payeeName: UPI_PAYEE_NAME,
      qrImageUrl: UPI_QR_IMAGE,
    },
  });
});

// ─── 2. Create Payment Intent & Generate Dynamic UPI URI / QR (Public or Authenticated) ───
router.post('/create-intent', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { planId, userEmail, userName } = req.body;
    const plan = PLANS.find((p) => p.id === planId) || PLANS[0];

    const orderId = generateOrderId(plan.id);
    const studentName = req.user?.name || userName || 'GATE Student';
    const note = `Abhiyantra ${plan.name.slice(0, 18)} - ${orderId}`;

    const upiUri = buildUpiUri(UPI_PAYEE_ID, UPI_PAYEE_NAME, plan.price, orderId, note);

    res.json({
      success: true,
      orderId,
      plan,
      upiUri,
      payeeId: UPI_PAYEE_ID,
      payeeName: UPI_PAYEE_NAME,
      qrImageUrl: UPI_QR_IMAGE,
      amount: plan.price,
      note,
      user: {
        email: req.user?.email || userEmail,
        name: studentName,
      },
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: 'Failed to initiate payment intent.' });
  }
});

// ─── 3. Submit 12-digit UTR & Activate Instant Access (Authenticated) ───
router.post('/submit-utr', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { planId, utrNumber, orderId } = req.body;

    if (!utrNumber || typeof utrNumber !== 'string') {
      res.status(400).json({ error: '12-digit UTR / Reference Number is required.' });
      return;
    }

    // Clean input: remove spaces, hyphens
    const cleanUtr = utrNumber.replace(/[\s-]/g, '').trim();

    // Standard Indian banking UTR: exactly 12 digits (numeric)
    if (!/^\d{12}$/.test(cleanUtr)) {
      res.status(400).json({
        error: 'Invalid UTR format. A valid UPI transaction reference number (UTR) must be exactly 12 digits (e.g. 432819284712).',
      });
      return;
    }

    const plan = PLANS.find((p) => p.id === planId) || PLANS[0];
    const durationDays = plan.durationDays;
    const expiryDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

    if (isDbConfigured && prisma) {
      // Check if UTR was already submitted by another user
      const existingPayment = await prisma.paymentRecord.findUnique({
        where: { utrNumber: cleanUtr },
      });

      if (existingPayment) {
        if (existingPayment.userId !== user.id) {
          res.status(400).json({
            error: 'This UTR number has already been claimed by another account. If you believe this is a mistake, contact admin support.',
          });
          return;
        }

        // Same user re-submitting same UTR: update subscription and return
        await prisma.user.update({
          where: { id: user.id },
          data: {
            isSubscribed: true,
            subscriptionTier: plan.id,
            subscriptionUntil: expiryDate,
          },
        });

        res.json({
          success: true,
          message: 'Payment already registered! Your test series access is active.',
          payment: existingPayment,
          isSubscribed: true,
          subscriptionUntil: expiryDate.toISOString(),
          tier: plan.id,
        });
        return;
      }

      // Record new payment & activate instant provisional access
      const newPayment = await prisma.paymentRecord.create({
        data: {
          userId: user.id,
          planId: plan.id,
          planName: plan.name,
          amount: plan.price,
          utrNumber: cleanUtr,
          upiIdUsed: UPI_PAYEE_ID,
          status: 'PENDING',
          adminNote: orderId ? `Order: ${orderId}` : undefined,
        },
      });

      // Grant instant access to the user
      await prisma.user.update({
        where: { id: user.id },
        data: {
          isSubscribed: true,
          subscriptionTier: plan.id,
          subscriptionUntil: expiryDate,
        },
      });

      res.json({
        success: true,
        message: 'Payment received! Your GATE Test Series access is now unlocked.',
        payment: newPayment,
        isSubscribed: true,
        subscriptionUntil: expiryDate.toISOString(),
        tier: plan.id,
      });
      return;
    }

    // Fallback if DB is not active
    res.json({
      success: true,
      message: 'Payment registered in client storage. Access granted.',
      isSubscribed: true,
      subscriptionUntil: expiryDate.toISOString(),
      tier: plan.id,
    });
  } catch (error) {
    console.error('Error submitting UTR:', error);
    res.status(500).json({ error: 'Failed to process payment verification. Please try again.' });
  }
});

// ─── 4. Current User Subscription Status (Authenticated) ───
router.get('/status', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;

    if (isDbConfigured && prisma) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          payments: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (dbUser) {
        const isSubscribed = Boolean(
          dbUser.isSubscribed &&
          (!dbUser.subscriptionUntil || new Date(dbUser.subscriptionUntil) > new Date())
        );

        res.json({
          success: true,
          isSubscribed,
          subscriptionTier: dbUser.subscriptionTier,
          subscriptionUntil: dbUser.subscriptionUntil?.toISOString() || null,
          payments: dbUser.payments,
        });
        return;
      }
    }

    res.json({
      success: true,
      isSubscribed: Boolean(user.isSubscribed),
      subscriptionTier: user.subscriptionTier || null,
      subscriptionUntil: user.subscriptionUntil || null,
      payments: [],
    });
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    res.status(500).json({ error: 'Failed to check subscription status.' });
  }
});

// ─── 5. Admin: List All Payments & Stats (Master Admin Only) ───
router.get('/admin/all', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    if (user.role !== 'ADMIN' && user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      res.status(403).json({ error: 'Access denied. Master Admin privileges required.' });
      return;
    }

    if (!isDbConfigured || !prisma) {
      res.json({ success: true, payments: [], stats: { total: 0, verified: 0, pending: 0, revenue: 0 } });
      return;
    }

    const payments = await prisma.paymentRecord.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            isSubscribed: true,
            subscriptionUntil: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalRevenue = payments
      .filter((p) => p.status === 'VERIFIED' || p.status === 'PENDING')
      .reduce((sum, p) => sum + p.amount, 0);

    const stats = {
      total: payments.length,
      verified: payments.filter((p) => p.status === 'VERIFIED').length,
      pending: payments.filter((p) => p.status === 'PENDING').length,
      rejected: payments.filter((p) => p.status === 'REJECTED').length,
      revenue: totalRevenue,
    };

    res.json({
      success: true,
      payments,
      stats,
    });
  } catch (error) {
    console.error('Admin payments fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch payment records.' });
  }
});

// ─── 6. Admin: Verify or Reject Payment Record (Master Admin Only) ───
router.post('/admin/verify', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    if (user.role !== 'ADMIN' && user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      res.status(403).json({ error: 'Access denied. Master Admin privileges required.' });
      return;
    }

    const { paymentId, status, adminNote } = req.body;
    if (!paymentId || !['VERIFIED', 'REJECTED', 'PENDING'].includes(status)) {
      res.status(400).json({ error: 'Valid paymentId and status (VERIFIED | REJECTED | PENDING) are required.' });
      return;
    }

    if (!isDbConfigured || !prisma) {
      res.status(500).json({ error: 'Database not available.' });
      return;
    }

    const payment = await prisma.paymentRecord.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      res.status(404).json({ error: 'Payment record not found.' });
      return;
    }

    // Update payment record
    const updatedPayment = await prisma.paymentRecord.update({
      where: { id: paymentId },
      data: {
        status,
        adminNote: adminNote !== undefined ? adminNote : payment.adminNote,
        verifiedAt: status === 'VERIFIED' ? new Date() : null,
      },
    });

    // If rejected, revoke user subscription unless they have another verified payment
    if (status === 'REJECTED') {
      const otherActivePayments = await prisma.paymentRecord.count({
        where: {
          userId: payment.userId,
          id: { not: paymentId },
          status: { in: ['VERIFIED', 'PENDING'] },
        },
      });

      if (otherActivePayments === 0) {
        await prisma.user.update({
          where: { id: payment.userId },
          data: {
            isSubscribed: false,
            subscriptionUntil: null,
          },
        });
      }
    } else if (status === 'VERIFIED') {
      // Ensure user subscription is active
      const plan = PLANS.find((p) => p.id === payment.planId) || PLANS[0];
      const expiry = new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000);
      await prisma.user.update({
        where: { id: payment.userId },
        data: {
          isSubscribed: true,
          subscriptionTier: payment.planId,
          subscriptionUntil: expiry,
        },
      });
    }

    res.json({
      success: true,
      message: `Payment record status updated to ${status}.`,
      payment: updatedPayment,
    });
  } catch (error) {
    console.error('Admin payment verification error:', error);
    res.status(500).json({ error: 'Failed to update payment status.' });
  }
});

export default router;
