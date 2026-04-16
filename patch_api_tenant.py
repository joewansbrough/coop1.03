import re
import sys

def patch_api_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    def replacer(match):
        prefix = match.group(0)
        # If already has cooperativeId, skip
        if 'cooperativeId' in prefix or 'cooperativeId' in content[match.start():match.start()+200]:
            return prefix
        
        prisma_obj = "getPrisma()"
        if " p." in prefix: prisma_obj = "p"
        
        return prefix + f"\n      cooperativeId: await getCoopId(req, {prisma_obj}),"

    content = re.sub(r'(?:getPrisma\(\)|p)\.(?:tenant|unit)\.create\(\{\s*data:\s*\{', replacer, content)

    with open(filepath, 'w') as f:
        f.write(content)
        
    print(f"Patched {filepath}")

patch_api_file('api/index.ts')
