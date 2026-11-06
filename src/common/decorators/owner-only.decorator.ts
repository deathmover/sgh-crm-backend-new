import { SetMetadata } from '@nestjs/common';

export const OWNER_ONLY_KEY = 'ownerOnly';
/** Staff logins get 403 on this route or controller; owners pass. */
export const OwnerOnly = () => SetMetadata(OWNER_ONLY_KEY, true);

/** Roles with full access. "admin" is kept for logins made by older versions. */
export const OWNER_ROLES = ['super_admin', 'owner', 'admin'];
export const isOwner = (user?: { role?: string } | null) => !!user?.role && OWNER_ROLES.includes(user.role);
