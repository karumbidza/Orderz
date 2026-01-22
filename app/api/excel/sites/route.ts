import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
import { getSearchParams } from '@/lib/api-utils';

// ─────────────────────────────────────────────
// GET /api/excel/sites - Excel-optimized sites export
// Returns flat structure for dropdowns and lookups
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = getSearchParams(request);
    const format = params.get('format') || 'json';
    
    const sites = await sql`
      SELECT 
        id,
        site_code as code,
        name,
        city,
        COALESCE(address, '') as address,
        COALESCE(contact_name, '') as contact_person,
        COALESCE(email, '') as email,
        COALESCE(phone, '') as phone
      FROM sites 
      WHERE is_active = true
      ORDER BY name
    `;
    
    if (format === 'csv') {
      const headers = ['id', 'code', 'name', 'city', 'address', 'contact_person', 'email', 'phone'];
      const rows = sites.map((row: Record<string, unknown>) => 
        headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(',')
      );
      const csv = [headers.join(','), ...rows].join('\n');
      
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="sites.csv"',
        },
      });
    }
    
    return Response.json({ success: true, sites, count: sites.length });
  } catch (error) {
    console.error('Excel sites export error:', error);
    return Response.json({ error: 'Export failed', details: String(error) }, { status: 500 });
  }
}
