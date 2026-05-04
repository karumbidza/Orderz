// Ad-hoc tsx checks for the orders-export work.
// Run: npx tsx scripts/test-orders-export.ts

import { OrderExportFiltersSchema } from '../lib/validations';

let failures = 0;
function check(label: string, condition: boolean) {
  if (condition) console.log(`  PASS  ${label}`);
  else { console.error(`  FAIL  ${label}`); failures++; }
}

{
  const r = OrderExportFiltersSchema.safeParse({});
  check('accepts empty filter (defaults pending_only=true)',
    r.success && r.data.pending_only === true);
}
{
  const r = OrderExportFiltersSchema.safeParse({
    status: ['PENDING', 'PARTIAL_DISPATCH'],
    category: ['Uniforms'],
    site_search: 'Beit',
    from: '2026-04-01',
    to: '2026-05-04',
    amount_min: 0,
    amount_max: 10000,
    pending_only: false,
  });
  check('accepts full filter set', r.success);
}
{
  const r = OrderExportFiltersSchema.safeParse({ status: ['NOT_A_REAL_STATUS'] });
  check('rejects unknown status', !r.success);
}
{
  const r = OrderExportFiltersSchema.safeParse({ from: '2026-13-99' });
  check('rejects malformed from date', !r.success);
}
{
  const r = OrderExportFiltersSchema.safeParse({ from: '2026-05-10', to: '2026-05-01' });
  check('rejects from > to', !r.success);
}
{
  const r = OrderExportFiltersSchema.safeParse({ amount_min: -1 });
  check('rejects negative amount_min', !r.success);
}

if (failures > 0) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\nAll checks passed');
