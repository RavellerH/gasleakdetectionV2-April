import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import jwt from 'jsonwebtoken';

const DEV_JWT_SECRET = 'dev-secret-change-me-before-production';

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: string;
  ruId: string;
}

function jwtSecret(): string {
  const configured = process.env.JWT_SECRET;
  if (configured && (process.env.NODE_ENV !== 'production' || configured !== DEV_JWT_SECRET)) return configured;
  if (process.env.NODE_ENV === 'production') throw new Error('A non-default JWT_SECRET is required when NODE_ENV=production');
  return DEV_JWT_SECRET;
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, jwtSecret(), { expiresIn: '12h' });
}

export function extractUserFromRequest(req: { headers?: Record<string, unknown> } | undefined): AuthTokenPayload | null {
  const header = req?.headers?.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(header.slice('Bearer '.length), jwtSecret()) as AuthTokenPayload;
  } catch {
    return null;
  }
}

@Injectable()
export class GqlAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = GqlExecutionContext.create(context).getContext().user as AuthTokenPayload | null;
    if (!user) throw new UnauthorizedException('Authentication required');
    return true;
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = GqlExecutionContext.create(context).getContext().user as AuthTokenPayload | null;
    if (!user) throw new UnauthorizedException('Authentication required');
    if (user.role !== 'ADMIN') throw new UnauthorizedException('Admin role required');
    return true;
  }
}
