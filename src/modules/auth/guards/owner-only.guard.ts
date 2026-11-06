import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OWNER_ONLY_KEY, isOwner } from '../../../common/decorators/owner-only.decorator';

/** Routes a login that must change its password can still use. */
const PASSWORD_CHANGE_ROUTES = ['/auth/profile', '/auth/change-password'];

/**
 * Runs after JwtAuthGuard (registered second), so request.user is set.
 * Blocks everything until a temporary/default password is changed, and blocks
 * owner-only routes for staff logins.
 */
@Injectable()
export class OwnerOnlyGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const { user } = request;
    if (!user) return true; // public route

    if (user.mustChangePassword && !PASSWORD_CHANGE_ROUTES.some((r) => request.path?.endsWith(r))) {
      throw new ForbiddenException('Change your password first');
    }

    const ownerOnly = this.reflector.getAllAndOverride<boolean>(OWNER_ONLY_KEY, [context.getHandler(), context.getClass()]);
    if (!ownerOnly || isOwner(user)) return true;
    throw new ForbiddenException('Only the owner can do this');
  }
}
