import { CooperativeResolutionError, resolveCooperativeIdForRequest } from './coopResolution.js';

type TransactionClient = Record<string, any>;

type PrismaWithTransaction = TransactionClient & {
  cooperative: { findUnique: (args: any) => Promise<any>; findFirst: (args?: any) => Promise<any> };
  user?: { findFirst: (args: any) => Promise<any> };
  tenant?: { findFirst: (args: any) => Promise<any> };
  $transaction: <T>(callback: (tx: TransactionClient) => Promise<T>) => Promise<T>;
};

export class TenantContextError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'TenantContextError';
    this.statusCode = statusCode;
  }
}

export type TenantContext = {
  tx: TransactionClient;
  cooperativeId: string;
  user: any;
  memberships: any[];
  permissions: {
    isAdmin: boolean;
    groupSlugs: string[];
  };
};

export type CooperativeContext = {
  tx: TransactionClient;
  cooperativeId: string;
};

const findCooperative = async (tx: TransactionClient, cooperativeId: string) =>
  tx.cooperative.findUnique({ where: { id: cooperativeId } });

const assertAvailableCooperative = (cooperative: any) => {
  if (!cooperative?.id) throw new TenantContextError(404, 'Cooperative not found.');
  const status = String(cooperative.status || '').toUpperCase();
  if (status === 'ARCHIVED') throw new TenantContextError(410, 'Cooperative is archived.');
  if (status === 'SUSPENDED') throw new TenantContextError(403, 'Cooperative is suspended.');
  return cooperative;
};

const toTenantContextError = (error: unknown) => {
  if (error instanceof TenantContextError) return error;
  if (error instanceof CooperativeResolutionError) {
    return new TenantContextError(error.statusCode, error.message);
  }
  return error;
};

export const withTenantContext = async <T>(
  prisma: PrismaWithTransaction,
  req: any,
  callback: (context: TenantContext) => Promise<T>,
) => {
  const sessionUser = req?.user || req?.session?.user;
  const email = String(sessionUser?.email || '').trim().toLowerCase();
  if (!email) throw new TenantContextError(401, 'Authenticated session required.');

  try {
    const cooperativeId = await resolveCooperativeIdForRequest(prisma, req, email);
    return prisma.$transaction(async tx => {
      assertAvailableCooperative(await findCooperative(tx, cooperativeId));
      const user = await tx.user.findFirst({
        where: { cooperativeId, email, isActive: true },
        include: { memberships: { where: { isActive: true }, include: { group: true } } },
      });
      if (!user) throw new TenantContextError(403, 'Active cooperative membership required.');

      const memberships = user.memberships || [];
      const groupSlugs = memberships.map((membership: any) => membership.group?.slug).filter(Boolean);
      return callback({
        tx,
        cooperativeId,
        user,
        memberships,
        permissions: {
          isAdmin: Boolean(user.isSystemAdmin || groupSlugs.includes('admin')),
          groupSlugs,
        },
      });
    });
  } catch (error) {
    throw toTenantContextError(error);
  }
};

export const withCooperativeContext = async <T>(
  prisma: PrismaWithTransaction,
  cooperativeId: string,
  callback: (context: CooperativeContext) => Promise<T>,
) => {
  const scopedCooperativeId = String(cooperativeId || '').trim();
  if (!scopedCooperativeId) {
    throw new TenantContextError(400, 'cooperativeId is required for background cooperative context.');
  }

  return prisma.$transaction(async tx => {
    assertAvailableCooperative(await findCooperative(tx, scopedCooperativeId));
    return callback({ tx, cooperativeId: scopedCooperativeId });
  });
};
