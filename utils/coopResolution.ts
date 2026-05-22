export const OBHC_COOPERATIVE_SLUG = 'obhc';
export const SUPERUSER_EMAILS = ['joewansbrough@gmail.com', 'joewcoupons@gmail.com'];
export const DEFAULT_COOPERATIVE_HOST_SUFFIXES = ['coophub.test', 'coophub.localhost'];

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

export class CooperativeResolutionError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'CooperativeResolutionError';
    this.statusCode = statusCode;
  }
}

const existingCooperativeId = async (p: PrismaLike, cooperativeId?: string | null) => {
  if (!cooperativeId) return null;
  const cooperative = await p.cooperative.findUnique({ where: { id: cooperativeId } });
  return cooperative?.id || null;
};

const defaultSuperuserCooperativeId = async (p: PrismaLike) => {
  const obhc = await p.cooperative.findUnique({ where: { slug: OBHC_COOPERATIVE_SLUG } });
  if (obhc?.id) return obhc.id;
  throw new CooperativeResolutionError(404, 'Default cooperative is not configured.');
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
  throw new CooperativeResolutionError(403, 'No cooperative membership found for this user.');
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

const normalizeHost = (host?: string | null) =>
  String(host || '')
    .split(',')[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '');

const getRequestHost = (req: any) =>
  normalizeHost(req?.get?.('x-forwarded-host') || req?.get?.('host') || req?.headers?.['x-forwarded-host'] || req?.headers?.host);

const isLocalHost = (host: string) =>
  host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.localhost');

const cooperativeHostSuffixes = () =>
  String(process.env.COOPERATIVE_HOST_SUFFIXES || DEFAULT_COOPERATIVE_HOST_SUFFIXES.join(','))
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);

const hostSubdomain = (host: string) => {
  if (!host || isLocalHost(host)) return null;
  const suffix = cooperativeHostSuffixes().find(item => host.endsWith(`.${item}`));
  if (!suffix) return null;

  const subdomainPart = host.slice(0, -suffix.length - 1);
  if (!subdomainPart || subdomainPart.includes('.')) return null;
  if (subdomainPart === 'www') return null;
  return subdomainPart;
};

const assertCooperativeAvailable = (cooperative: any) => {
  const status = String(cooperative?.status || '').toUpperCase();
  if (status === 'ARCHIVED') {
    throw new CooperativeResolutionError(410, 'This cooperative workspace is archived.');
  }
  if (status === 'SUSPENDED') {
    throw new CooperativeResolutionError(403, 'This cooperative workspace is suspended.');
  }
  return cooperative;
};

const resolveCooperativeIdForHost = async (p: PrismaLike, req: any) => {
  const host = getRequestHost(req);
  const subdomain = hostSubdomain(host);
  if (!subdomain) return null;

  const cooperative = await p.cooperative.findUnique({ where: { subdomain } });
  if (!cooperative?.id) {
    throw new CooperativeResolutionError(404, 'Cooperative workspace not found for this host.');
  }

  return assertCooperativeAvailable(cooperative).id;
};

export const resolveCooperativeIdForRequest = async (
  p: PrismaLike,
  req: any,
  email?: string | null,
) => {
  const hostCooperativeId = await resolveCooperativeIdForHost(p, req);
  if (hostCooperativeId) return hostCooperativeId;

  const sessionUser = req?.user || req?.session?.user;
  const selectedCooperativeId = sessionUser?.selectedCooperativeId || sessionUser?.cooperativeId || null;
  const resolvedEmail = email || sessionUser?.email || null;
  const host = getRequestHost(req);

  if (sessionUser?.isSystemAdmin || isSuperuserEmail(resolvedEmail)) {
    return resolveCooperativeIdForEmail(p, resolvedEmail, { selectedCooperativeId });
  }

  if (selectedCooperativeId && isLocalHost(host)) return selectedCooperativeId;
  return resolveCooperativeIdForEmail(p, resolvedEmail);
};
