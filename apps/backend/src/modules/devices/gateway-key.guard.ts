import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class GatewayKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = GqlExecutionContext.create(context).getContext().req;
    const key = req.headers['x-gateway-key'];
    const expected = process.env.GATEWAY_SYNC_KEY;
    if (!expected || key !== expected) {
      throw new UnauthorizedException('Invalid or missing x-gateway-key');
    }
    return true;
  }
}
