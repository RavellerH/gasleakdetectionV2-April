import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = '12h';

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: string;
  ruId: string;
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
  } catch {
    return null;
  }
}

/** Decodes the Authorization: Bearer <token> header, if present and valid, into the GraphQL context's `user`. */
export function extractUserFromRequest(req: { headers?: Record<string, unknown> } | undefined): AuthTokenPayload | null {
  const header = req?.headers?.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  return verifyToken(header.slice('Bearer '.length));
}

/** Requires a valid, logged-in user of any role. */
@Injectable()
export class GqlAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const gqlCtx = GqlExecutionContext.create(context).getContext();
    if (!gqlCtx.user) throw new UnauthorizedException('Authentication required');
    return true;
  }
}

/** Requires a valid, logged-in user with the ADMIN role. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const gqlCtx = GqlExecutionContext.create(context).getContext();
    if (!gqlCtx.user) throw new UnauthorizedException('Authentication required');
    if (gqlCtx.user.role !== 'ADMIN') throw new UnauthorizedException('Admin role required');
    return true;
  }
}
