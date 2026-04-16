import re
import sys

def patch_server_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # 1. Inject getCoopId helper if not exists
    if 'const getCoopId =' not in content:
        helper = """
const getCoopId = async (req: any, p: any = prisma) => {
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
        # Insert near the top, after imports or db setup
        match = re.search(r'const requireAuth = \(req:(.*?)\{', content)
        if match:
            content = content[:match.start()] + helper + "\n" + content[match.start():]

    # 2. Patch move-out tenantHistory.create
    # We must add cooperativeId: resident.cooperativeId
    out_target = """moveReason: reason || 'Household Move-out (Archived)'"""
    if out_target in content and 'cooperativeId: resident.cooperativeId' not in content:
        content = content.replace(out_target, out_target + ",\n                cooperativeId: resident.cooperativeId")

    # 3. Patch move-in tenantHistory.create
    in_target = """moveReason: 'Move-in'"""
    if in_target in content and 'cooperativeId:' not in content:
        # Also need updatedTenant if we aren't fetching it. Actually since move-in fetches tenant separately or updates it, let's just make sure updatedTenant is assigned.
        content = re.sub(r'await tx\.tenant\.update\({', r'const updatedTenant = await tx.tenant.update({', content, count=1)
        content = content.replace(in_target, in_target + ",\n            cooperativeId: updatedTenant.cooperativeId")

    # 4. Patch transfer tenantHistory.create
    transfer_target = """moveReason: 'Internal Transfer'"""
    # Note: there is update and create for transfer. We want the create.
    # The create looks like: "moveReason: 'Internal Transfer'\n            }"
    # Wait, it's easier to use python regex dynamically.
    if transfer_target in content and 'cooperativeId: resident.cooperativeId' not in content:
        content = content.replace(transfer_target + "\n            }", transfer_target + ",\n              cooperativeId: resident.cooperativeId\n            }")

    # 5. Patch Documents, Maintenance, Announcements, Events endpoints
    # E.g., const document = await prisma.document.create({ data: { ... } })
    
    # We need to inject await getCoopId(req) into these create functions.
    # Let's handle them generically via regex.
    # Any `prisma.something.create({ data: { `
    def replacer(match):
        prefix = match.group(0)
        # If already has cooperativeId, skip
        if 'cooperativeId' in prefix or 'cooperativeId' in content[match.start():match.start()+200]:
            return prefix
        
        # Inject cooperativeId
        prisma_obj = "tx" if "tx." in prefix else "prisma"
        if "getPrisma()" in prefix: prisma_obj = "getPrisma()"
        if " p." in prefix: prisma_obj = "p"
        
        return prefix + f"\n      cooperativeId: await getCoopId(req, {prisma_obj}),"

    content = re.sub(r'(?:prisma|tx|getPrisma\(\)|p)\.(?:document|maintenanceRequest|announcement|coopEvent|committee)\.create\(\{\s*data:\s*\{', replacer, content)

    with open(filepath, 'w') as f:
        f.write(content)
        
    print(f"Patched {filepath}")

patch_server_file('server.ts')
