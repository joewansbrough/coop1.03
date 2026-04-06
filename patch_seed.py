from pathlib import Path
path = Path('prisma/seed.ts')
text = path.read_text(encoding='utf-8', newline='')
lines = text.split('\r\n')
replacements = {
    "console.log('? Seeding complete!');": "  console.log('Seeding complete!');",
    "console.log(`  • ${units.length} units`);": "  console.log(`  - ${units.length} units`);",
    "console.log(`  • ${Object.keys(tenants).length} tenants`);": "  console.log(`  - ${Object.keys(tenants).length} tenants`);",
    "console.log('  • 12 maintenance requests');": "  console.log('  - 12 maintenance requests');",
    "console.log('  • 7 announcements');": "  console.log('  - 7 announcements');",
    "console.log('  • 12 documents');": "  console.log('  - 12 documents');",
    "console.log('  • 6 committees');": "  console.log('  - 6 committees');",
    "console.log('  • Monthly calendar events through end of 2026');": "  console.log('  - Monthly calendar events through end of 2026');",
}
modified = False
for idx, line in enumerate(lines):
    if line in replacements:
        lines[idx] = replacements[line]
        modified = True
if not modified:
    raise SystemExit('no replacements applied')
path.write_text('\r\n'.join(lines), encoding='utf-8', newline='')
