import type { Request, Response, NextFunction } from "express";
import { jwtVerify, createRemoteJWKSet, type JWTPayload } from "jose";

// Simple feature flag to allow incremental rollout
// When AUTH_ENABLED != 'true', requests are allowed through with a dev userId
const AUTH_ENABLED = process.env.AUTH_ENABLED === 'true';

// Config
const SUPABASE_JWKS_URL = process.env.SUPABASE_JWKS_URL; // Optional
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET; // Optional (HS256)
const DEV_USER_ID = process.env.DEV_USER_ID || 'dev-user-00000000-0000-0000-0000-000000000000';

type VerifiedSession = {
  userId: string;
  raw: JWTPayload;
};

async function verifySupabaseJwt(token: string): Promise<VerifiedSession> {
  // Prefer JWKS if provided, otherwise fall back to HS256 secret
  if (SUPABASE_JWKS_URL) {
    const jwks = createRemoteJWKSet(new URL(SUPABASE_JWKS_URL));
    const { payload } = await jwtVerify(token, jwks, {
      // Allow small clock skew
      clockTolerance: 5,
    });
    const userId = typeof payload.sub === 'string' ? payload.sub : '';
    if (!userId) {
      throw new Error('MISSING_SUB');
    }
    return { userId, raw: payload };
  }

  if (SUPABASE_JWT_SECRET) {
    const secret = new TextEncoder().encode(SUPABASE_JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, {
      clockTolerance: 5,
    });
    const userId = typeof payload.sub === 'string' ? payload.sub : '';
    if (!userId) {
      throw new Error('MISSING_SUB');
    }
    return { userId, raw: payload };
  }

  throw new Error('AUTH_MISCONFIGURED');
}

export async function authenticateRequest(req: Request): Promise<VerifiedSession> {
  if (!AUTH_ENABLED) {
    return { userId: DEV_USER_ID, raw: { sub: DEV_USER_ID } };
  }

  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader || Array.isArray(authHeader)) {
    throw Object.assign(new Error('MISSING_AUTH_HEADER'), { status: 401 });
  }
  const match = /^Bearer\s+(.+)$/i.exec(String(authHeader));
  if (!match) {
    throw Object.assign(new Error('INVALID_AUTH_SCHEME'), { status: 401 });
  }
  const token = match[1];
  try {
    return await verifySupabaseJwt(token);
  } catch (error: any) {
    const message = error?.code === 'ERR_JWT_EXPIRED' ? 'TOKEN_EXPIRED' : (error?.message || 'INVALID_TOKEN');
    const status = message === 'TOKEN_EXPIRED' ? 401 : 401;
    throw Object.assign(new Error(message), { status });
  }
}

export function requireAuth() {
  return async function (req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = await authenticateRequest(req);
      (req as any).userId = userId;
      next();
    } catch (error: any) {
      const status = error?.status || 401;
      const message = error?.message || 'UNAUTHORIZED';
      // Minimal logging without PII
      console.warn('[auth] rejected request', {
        path: req.path,
        method: req.method,
        status,
        code: message,
      });
      res.status(status).json({ error: 'UNAUTHORIZED', message });
    }
  };
}

export type WithUserId = Request & { userId?: string };


