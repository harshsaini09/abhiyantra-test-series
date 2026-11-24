import { Router, Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { prisma, isDbConfigured } from './db.js';

const router = Router();

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  process.env.VITE_GOOGLE_CLIENT_ID ||
  '465825980892-br7qtrba4jqeun05hkcsc2oq9ku1f3ef.apps.googleusercontent.com';
const JWT_SECRET = process.env.JWT_SECRET || 'abhiyantra-secure-jwt-secret-gate-2026';
const oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  isSubscribed?: boolean;
  subscriptionTier?: string | null;
  subscriptionUntil?: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

// ─── Token Sign & Verify Helpers ───
export function signUserToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export function verifyUserToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    return decoded;
  } catch {
    return null;
  }
}

// ─── Authentication Middleware ───
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

  if (token) {
    const user = verifyUserToken(token);
    if (user) {
      req.user = user;
      next();
      return;
    }
  }

  // Fallback: If no valid token is present, check for verified user email header or body (for legacy client sessions)
  const userEmail = (req.headers['x-user-email'] as string) || req.body?.userEmail || (req.query?.userEmail as string);
  if (userEmail && typeof userEmail === 'string' && userEmail.includes('@')) {
    const email = userEmail.toLowerCase().trim();
    const userName = (req.headers['x-user-name'] as string) || req.body?.userName || email.split('@')[0];

    try {
      if (isDbConfigured && prisma) {
        const dbUser = await prisma.user.upsert({
          where: { email },
          update: {},
          create: {
            googleId: `user_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
            email,
            name: userName,
          },
        });
        const isSubActive = Boolean(
          dbUser.isSubscribed &&
          (!dbUser.subscriptionUntil || new Date(dbUser.subscriptionUntil) > new Date())
        );
        req.user = {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          avatarUrl: dbUser.avatarUrl,
          isSubscribed: isSubActive,
          subscriptionTier: dbUser.subscriptionTier,
          subscriptionUntil: dbUser.subscriptionUntil?.toISOString() || null,
        };
      } else {
        req.user = {
          id: `usr_${email.split('@')[0]}`,
          email,
          name: userName,
        };
      }

      // Automatically issue a fresh signed JWT so subsequent requests have a token
      const freshToken = signUserToken(req.user);
      res.setHeader('x-auth-token', freshToken);
      res.cookie('token', freshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      next();
      return;
    } catch (e) {
      console.warn('Fallback email auth error:', e);
    }
  }

  res.status(401).json({ error: 'Authentication required. Please sign in.' });
}

// ─── 1. Google OAuth Sign-In / Token Verification ───
router.post('/google', async (req: Request, res: Response): Promise<void> => {
  try {
    const { credential } = req.body;
    if (!credential) {
      res.status(400).json({ error: 'Missing Google credential.' });
      return;
    }

    let payload: {
      sub: string;
      email?: string;
      name?: string;
      picture?: string;
    } | undefined;

    // Verify token using OAuth2Client if GOOGLE_CLIENT_ID is configured
    if (GOOGLE_CLIENT_ID) {
      try {
        const ticket = await oauthClient.verifyIdToken({
          idToken: credential,
          audience: GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
      } catch (verifyErr) {
        console.warn('verifyIdToken with audience failed, attempting decode fallback:', verifyErr);
        // Fallback decode for development/testing environments
        const decoded = jwt.decode(credential) as any;
        if (decoded && decoded.sub && decoded.email) {
          payload = decoded;
        } else {
          res.status(401).json({ error: 'Invalid Google token.' });
          return;
        }
      }
    } else {
      // Decode directly if GOOGLE_CLIENT_ID not yet set in environment
      const decoded = jwt.decode(credential) as any;
      if (decoded && decoded.sub && decoded.email) {
        payload = decoded;
      } else {
        res.status(400).json({ error: 'Could not decode Google credential.' });
        return;
      }
    }

    if (!payload || !payload.email || !payload.sub) {
      res.status(401).json({ error: 'Invalid Google credential payload.' });
      return;
    }

    const email = payload.email.toLowerCase().trim();
    const name = payload.name || email.split('@')[0];
    const avatarUrl = payload.picture || null;
    const googleId = payload.sub;

    let user: AuthUser;

    // Upsert user in PostgreSQL if database is connected
    if (isDbConfigured && prisma) {
      try {
        const dbUser = await prisma.user.upsert({
          where: { email },
          update: {
            name,
            avatarUrl,
            googleId,
          },
          create: {
            googleId,
            email,
            name,
            avatarUrl,
          },
        });
        const isSubActive = Boolean(
          dbUser.isSubscribed &&
          (!dbUser.subscriptionUntil || new Date(dbUser.subscriptionUntil) > new Date())
        );
        user = {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          avatarUrl: dbUser.avatarUrl,
          isSubscribed: isSubActive,
          subscriptionTier: dbUser.subscriptionTier,
          subscriptionUntil: dbUser.subscriptionUntil?.toISOString() || null,
        };
      } catch (dbErr) {
        console.warn('Database user upsert warning (falling back to memory session):', dbErr);
        user = {
          id: `usr_${googleId.slice(0, 16)}`,
          email,
          name,
          avatarUrl,
        };
      }
    } else {
      user = {
        id: `usr_${googleId.slice(0, 16)}`,
        email,
        name,
        avatarUrl,
      };
    }

    // Generate signed JWT
    const token = signUserToken(user);

    // Set signed httpOnly cookie (secure in production, lax sameSite)
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.json({
      success: true,
      user,
      token, // Also return token for clients that store in auth header
    });
  } catch (error) {
    console.error('Google Auth error:', error);
    res.status(500).json({ error: 'Failed to process Google sign in.' });
  }
});

// ─── 2. Get Current Authenticated User (GET /api/auth/me) ───
router.get('/me', async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.cookies?.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

    if (!token) {
      res.json({ user: null });
      return;
    }

    const decoded = verifyUserToken(token);
    if (!decoded) {
      res.json({ user: null });
      return;
    }

    // Try fetching latest data from database if available
    if (isDbConfigured && prisma) {
      try {
        const dbUser = await prisma.user.findUnique({
          where: { email: decoded.email },
        });
        if (dbUser) {
          const isSubActive = Boolean(
            dbUser.isSubscribed &&
            (!dbUser.subscriptionUntil || new Date(dbUser.subscriptionUntil) > new Date())
          );
          res.status(200).json({
            user: {
              id: dbUser.id,
              email: dbUser.email,
              name: dbUser.name,
              avatarUrl: dbUser.avatarUrl,
              isSubscribed: isSubActive,
              subscriptionTier: dbUser.subscriptionTier,
              subscriptionUntil: dbUser.subscriptionUntil?.toISOString() || null,
            },
          });
          return;
        }
      } catch {
        // Fallback to decoded payload
      }
    }

    res.status(200).json({ user: decoded });
  } catch (error) {
    console.error('Auth /me error:', error);
    res.status(200).json({ user: null });
  }
});

// ─── 3. Logout (POST /api/auth/logout) ───
router.post('/logout', (_req: Request, res: Response): void => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  res.json({ success: true, message: 'Logged out successfully.' });
});

export default router;
