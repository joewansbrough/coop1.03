export const OBHC_COOPERATIVE_SLUG = 'obhc';
export const SUPERUSER_EMAILS = ['joewansbrough@gmail.com', 'joewcoupons@gmail.com'];

type PrismaLike = {
  user?: { findFirst: (args: any) => Promise<any> };
  tenant?: { findFirst: (args: any) => Promise<any> };
  cooperative: {
    findUnique: (args: any) => Promise<any>;
    findFirst: (args?: any) => Promise<any>;
  };
};

export const normalizeEmail = (email?: string | null) => String(email || '').trim().toLowerCase();

export const isSuperuserEmail = (email?: string | null) => SUPERUSER_EMAILS.includes(normalizeEmail(email));

const existingCooperativeId = async (p: PrismaLike, cooperativeId?: string | null) => {
  if (!cooperativeId) return null;
  const cooperative = await p.cooperative.findUnique({ where: { id: cooperativeId } });
  return cooperative?.id || null;
};

const defaultSuperuserCooperativeId = async (p: PrismaLike) => {
  const obhc = await p.cooperative.findUnique({ where: { slug: OBHC_COOPERATIVE_SLUG } });
  if (obhc?.id) return obhc.id;
  const first = await p.cooperative.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!first?.id) throw new Error('No cooperative found in the system.');
  return first.id;
};

const firstCooperativeId = async (p: PrismaLike) => {
  const first = await p.cooperative.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!first?.id) throw new Error('No cooperative found in the system.');
  return first.id;
};

export const resolveCooperativeIdForEmail = async (
  p: PrismaLike,
  email?: string | null,
  options: { selectedCooperativeId?: string | null } = {},
) => {
  const normalizedEmail = normalizeEmail(email);
  const isSuperuser = isSuperuserEmail(normalizedEmail);

  if (isSuperuser) {
    const selected = await existingCooperativeId(p, options.selectedCooperativeId);
    if (selected) return selected;
  }

  if (normalizedEmail && p.user?.findFirst) {
    const user = await p.user.findFirst({
      where: { email: normalizedEmail, isActive: true },
      orderBy: [{ isSystemAdmin: 'desc' }, { updatedAt: 'desc' }],
    });
    if (user?.isSystemAdmin || isSuperuser) return defaultSuperuserCooperativeId(p);
    if (user?.cooperativeId) return user.cooperativeId;
  }

  if (normalizedEmail && p.tenant?.findFirst) {
    const tenant = await p.tenant.findFirst({
      where: { email: normalizedEmail },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    });
    if (tenant?.cooperativeId) return tenant.cooperativeId;
  }

  if (isSuperuser) return defaultSuperuserCooperativeId(p);
  return firstCooperativeId(p);
};

export const resolveKnownCooperativeIdForEmail = async (
  p: PrismaLike,
  email?: string | null,
  options: { selectedCooperativeId?: string | null } = {},
) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const isSuperuser = isSuperuserEmail(normalizedEmail);
  if (isSuperuser) {
    const selected = await existingCooperativeId(p, options.selectedCooperativeId);
    if (selected) return selected;
  }

  if (p.user?.findFirst) {
    const user = await p.user.findFirst({
      where: { email: normalizedEmail, isActive: true },
      orderBy: [{ isSystemAdmin: 'desc' }, { updatedAt: 'desc' }],
    });
    if (user?.isSystemAdmin || isSuperuser) return defaultSuperuserCooperativeId(p);
    if (user?.cooperativeId) return user.cooperativeId;
  }

  if (p.tenant?.findFirst) {
    const tenant = await p.tenant.findFirst({
      where: { email: normalizedEmail, status: { not: 'Inactive' } },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    });
    if (tenant?.cooperativeId) return tenant.cooperativeId;
  }

  if (isSuperuser) return defaultSuperuserCooperativeId(p);
  return null;
};

export const resolveCooperativeIdForRequest = async (
  p: PrismaLike,
  req: any,
  email?: string | null,
) => {
  const sessionUser = req?.user || req?.session?.user;
  const selectedCooperativeId = sessionUser?.selectedCooperativeId || sessionUser?.cooperativeId || null;
  const resolvedEmail = email || sessionUser?.email || null;

  if (sessionUser?.isSystemAdmin || isSuperuserEmail(resolvedEmail)) {
    return resolveCooperativeIdForEmail(p, resolvedEmail, { selectedCooperativeId });
  }

  if (selectedCooperativeId) return selectedCooperativeId;
  return resolveCooperativeIdForEmail(p, resolvedEmail);
};
