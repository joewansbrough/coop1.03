import re
import sys

def patch_api_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # 1. Inject getCoopId helper if not exists
    if 'const getCoopId =' not in content:
        helper = """
const getCoopId = async (req: any, p: any = getPrisma()) => {
  const sessionUser = req.session?.user;
  if (sessionUser?.tenantId) {
    const t = await p.tenant.findUnique({ where: { id: sessionUser.tenantId } });
    if (t?.cooperativeId) return t.cooperativeId;
  }
  const first = await p.cooperative.findFirst();
  if (!first) throw new Error("No cooperative found in the system.");
  return first.id;
};
"""
        # Insert near the top, after imports
        match = re.search(r'const requireAuth = \(req:(.*?)\{', content)
        if match:
            content = content[:match.start()] + helper + "\n" + content[match.start():]

    # 3. Patch move-in tenantHistory.create
    in_target = """data: { tenantId, unitId: id, startDate: new Date(date) }"""
    if in_target in content and 'cooperativeId' not in content[content.find(in_target)-50:content.find(in_target)+100]:
        content = content.replace(in_target, """data: { tenantId, unitId: id, startDate: new Date(date), cooperativeId: tenant.cooperativeId }""")

    # 4. Patch transfer tenantHistory.create
    transfer_target = """data: { tenantId: tenant.id, unitId: toUnitId, startDate: new Date(date) }"""
    if transfer_target in content and 'cooperativeId' not in content[content.find(transfer_target)-50:content.find(transfer_target)+150]:
        content = content.replace(transfer_target, """data: { tenantId: tenant.id, unitId: toUnitId, startDate: new Date(date), cooperativeId: tenant.cooperativeId }""")

    # 5. Patch Documents, Maintenance, Announcements, Events endpoints
    def replacer(match):
        prefix = match.group(0)
        # If already has cooperativeId, skip
        if 'cooperativeId' in prefix or 'cooperativeId' in content[match.start():match.start()+200]:
            return prefix
        
        prisma_obj = "getPrisma()"
        if " p." in prefix: prisma_obj = "p"
        
        return prefix + f"\n      cooperativeId: await getCoopId(req, {prisma_obj}),"

    content = re.sub(r'(?:getPrisma\(\)|p)\.(?:document|maintenanceRequest|announcement|coopEvent|committee)\.create\(\{\s*data:\s*\{', replacer, content)

    with open(filepath, 'w') as f:
        f.write(content)
        
    print(f"Patched {filepath}")

patch_api_file('api/index.ts')
