// ORDERZ-SEC
import { NextRequest, NextResponse } from 'next/server';

/**
 * Validates the Excel API key from request headers.
 * Returns null if valid, NextResponse error if invalid.
 *
 * VBA sends: x-excel-api-key: <key>
 */
export function validateExcelApiKey(
  req: NextRequest
): NextResponse | null {
  const apiKey = req.headers.get('x-excel-api-key');
  const validKey = process.env.EXCEL_API_KEY;

  if (!validKey) {
    console.error('[ORDERZ-SEC] EXCEL_API_KEY not configured');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  if (!apiKey || apiKey !== validKey) {
    console.warn('[ORDERZ-SEC] Invalid Excel API key attempt', {
      ip: req.headers.get('x-forwarded-for') ?? 'unknown',
      path: req.nextUrl.pathname,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return null; // valid
}
