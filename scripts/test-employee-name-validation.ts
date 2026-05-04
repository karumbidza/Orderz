// Ad-hoc Zod check for the order-related schemas with employee_name.
// Run: npx tsx scripts/test-employee-name-validation.ts

import { OrderItemCreateSchema, ExcelOrderSchema, OrderSubmitSchema } from '../lib/validations';

let failures = 0;

function check(label: string, condition: boolean) {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.error(`  FAIL  ${label}`);
    failures++;
  }
}

// Schema-level: employee_name is optional on the item itself
{
  const r = OrderItemCreateSchema.safeParse({ item_id: 1, quantity_ordered: 1 });
  check('OrderItemCreateSchema accepts item without employee_name', r.success);
}
{
  const r = OrderItemCreateSchema.safeParse({ item_id: 1, quantity_ordered: 1, employee_name: 'Jane Doe' });
  check('OrderItemCreateSchema accepts item with employee_name', r.success);
}

// Order-level: Uniforms requires employee_name on every item
{
  const r = ExcelOrderSchema.safeParse({
    site_code: 'HAR-001',
    category: 'Uniforms',
    items: [{ sku: 'UNI-001', quantity: 1 }],
  });
  check('ExcelOrderSchema rejects Uniforms order with missing employee_name', !r.success);
}
{
  const r = ExcelOrderSchema.safeParse({
    site_code: 'HAR-001',
    category: 'Uniforms',
    items: [{ sku: 'UNI-001', quantity: 1, employee_name: 'Jane Doe' }],
  });
  check('ExcelOrderSchema accepts Uniforms order with employee_name', r.success);
}
{
  const r = ExcelOrderSchema.safeParse({
    site_code: 'HAR-001',
    category: 'PPE',
    items: [{ sku: 'PPE-001', quantity: 5 }],
  });
  check('ExcelOrderSchema accepts non-Uniforms order without employee_name', r.success);
}
{
  const r = ExcelOrderSchema.safeParse({
    site_code: 'HAR-001',
    category: 'Uniforms',
    items: [
      { sku: 'UNI-001', quantity: 1, employee_name: 'Jane Doe' },
      { sku: 'UNI-002', quantity: 1, employee_name: '   ' },
    ],
  });
  check('ExcelOrderSchema rejects Uniforms order where one item has whitespace-only employee_name', !r.success);
}

// OrderSubmitSchema (the live workbook's actual endpoint, /api/excel/submit-order)
const baseItem = {
  item_id: 1,
  sku: 'UNI-001',
  item_name: 'Boots',
  quantity: 1,
  unit_cost: 10,
  line_total: 10,
};
const baseOrder = {
  site_id: 1,
  site_name: 'Test Site',
  requested_by: 'tester',
  total_amount: 10,
};
{
  const r = OrderSubmitSchema.safeParse({
    ...baseOrder,
    category: 'Uniforms',
    items: [baseItem],
  });
  check('OrderSubmitSchema rejects Uniforms order with missing employee_name', !r.success);
}
{
  const r = OrderSubmitSchema.safeParse({
    ...baseOrder,
    category: 'Uniforms',
    items: [{ ...baseItem, employee_name: 'Jane Doe' }],
  });
  check('OrderSubmitSchema accepts Uniforms order with employee_name', r.success);
}
{
  const r = OrderSubmitSchema.safeParse({
    ...baseOrder,
    category: 'PPE',
    items: [baseItem],
  });
  check('OrderSubmitSchema accepts non-Uniforms order without employee_name', r.success);
}
{
  const r = OrderSubmitSchema.safeParse({
    ...baseOrder,
    category: 'Uniforms',
    items: [
      { ...baseItem, employee_name: 'Jane Doe' },
      { ...baseItem, sku: 'UNI-002', employee_name: '   ' },
    ],
  });
  check('OrderSubmitSchema rejects Uniforms order where one item has whitespace-only employee_name', !r.success);
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nAll checks passed');
