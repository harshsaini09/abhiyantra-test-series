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
            upiIdUsed: 'Razorpay Checkout',
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

// Routes
router.post('/create-order', handleCreateOrder);
router.post('/verify-payment', handleVerifyPayment);

export default router;
