import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// POST /api/admin/fix-roles - Update roles based on SKU patterns
// One-time fix to populate role column from SKU
// ─────────────────────────────────────────────
export async function POST() {
  try {
    // Update Cashier roles
    const cashierResult = await sql`
      UPDATE items 
      SET role = 'Cashier' 
      WHERE sku LIKE '%-CAS-%' 
        AND (role = 'All' OR role IS NULL)
    `;
    
    // Update Manager roles
    const managerResult = await sql`
      UPDATE items 
      SET role = 'Manager' 
      WHERE sku LIKE '%-MGR-%' 
        AND (role = 'All' OR role IS NULL)
    `;
    
    // Update Supervisor roles
    const supervisorResult = await sql`
      UPDATE items 
      SET role = 'Supervisor' 
      WHERE sku LIKE '%-SUP-%' 
        AND (role = 'All' OR role IS NULL)
    `;
    
    // Update Merchandiser roles  
    const merchResult = await sql`
      UPDATE items 
      SET role = 'Merchandiser' 
      WHERE sku LIKE '%-MER-%' 
        AND (role = 'All' OR role IS NULL)
    `;
    
    // Update Driver roles
    const driverResult = await sql`
      UPDATE items 
      SET role = 'Driver' 
      WHERE sku LIKE '%-DRV-%' 
        AND (role = 'All' OR role IS NULL)
    `;
    
    // Update Security roles
    const securityResult = await sql`
      UPDATE items 
      SET role = 'Security' 
      WHERE sku LIKE '%-SEC-%' 
        AND (role = 'All' OR role IS NULL)
    `;
    
    return Response.json({
      success: true,
      message: 'Roles updated based on SKU patterns',
    });
    
  } catch (error) {
    console.error('Error fixing roles:', error);
    return Response.json({
      success: false,
      error: 'Failed to fix roles',
    }, { status: 500 });
  }
}
