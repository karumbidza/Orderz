import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import type { ApiResponse } from './types';

// ============================================
// API UTILITIES
// ============================================

// ─────────────────────────────────────────────
// RESPONSE HELPERS
// ─────────────────────────────────────────────
export function successResponse<T>(
  data: T,
  meta?: { total?: number; page?: number; limit?: number },
  message?: string
): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    message,
    meta,
  });
}

export function errorResponse(
  message: string,
  status: number = 400
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status }
  );
}

export function validationErrorResponse(error: ZodError): NextResponse<ApiResponse<null>> {
  const messages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
  return NextResponse.json(
    {
      success: false,
      error: 'Validation failed',
      message: messages.join('; '),
    },
    { status: 400 }
  );
}

// ─────────────────────────────────────────────
// AUTH MIDDLEWARE
// ─────────────────────────────────────────────
export function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('X-API-Key');
  const validKey = process.env.API_SECRET_KEY;
  
  // SECURITY: Require API key in production
  if (!validKey) {
    console.error('SECURITY: API_SECRET_KEY not configured');
    // In development without key configured, allow for testing
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    return false;
  }
  
  return apiKey === validKey;
}

export function validateAdminKey(request: NextRequest): boolean {
  const adminKey = request.headers.get('X-Admin-Key');
  const validKey = process.env.ADMIN_SECRET_KEY;
  
  // Admin routes require explicit key
  if (!validKey) {
    console.error('SECURITY: ADMIN_SECRET_KEY not configured');
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    return false;
  }
  
  return adminKey === validKey;
}

export function requireAuth(request: NextRequest): NextResponse | null {
  if (!validateApiKey(request)) {
    return errorResponse('Unauthorized: Invalid or missing API key', 401);
  }
  return null;
}

export function requireAdmin(request: NextRequest): NextResponse | null {
  if (!validateAdminKey(request)) {
    return errorResponse('Forbidden: Admin access required', 403);
  }
  return null;
}

// ─────────────────────────────────────────────
// RATE LIMITING (Simple in-memory, use Redis in production)
// ─────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 100; // 100 requests per minute

export function checkRateLimit(request: NextRequest): NextResponse | null {
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';
  const now = Date.now();
  
  const current = rateLimitMap.get(ip);
  
  if (!current || now > current.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return null;
  }
  
  if (current.count >= RATE_LIMIT_MAX) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded. Try again later.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }
  
  current.count++;
  return null;
}

// ─────────────────────────────────────────────
// QUERY HELPERS
// ─────────────────────────────────────────────
export function getSearchParams(request: NextRequest): URLSearchParams {
  return new URL(request.url).searchParams;
}

export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '50')));
  const offset = (page - 1) * limit;
  const sortBy = searchParams.get('sort_by') || 'id';
  const sortOrder = searchParams.get('sort_order') === 'desc' ? 'DESC' : 'ASC';
  
  return { page, limit, offset, sortBy, sortOrder };
}

// ─────────────────────────────────────────────
// SQL SANITIZATION
// ─────────────────────────────────────────────
// Note: Neon's tagged template literals handle parameterization.
// These are for dynamic column/table names only.
const ALLOWED_SORT_COLUMNS: Record<string, string[]> = {
  items: ['id', 'sku', 'category', 'product', 'cost', 'created_at'],
  sites: ['id', 'code', 'name', 'created_at'],
  warehouses: ['id', 'code', 'name', 'created_at'],
  orders: ['id', 'order_number', 'status', 'ordered_at', 'created_at'],
  stock_levels: ['id', 'quantity', 'updated_at'],
};

export function sanitizeSortColumn(table: string, column: string): string {
  const allowed = ALLOWED_SORT_COLUMNS[table] || ['id'];
  return allowed.includes(column) ? column : 'id';
}

// ─────────────────────────────────────────────
// ERROR HANDLING
// ─────────────────────────────────────────────
export function handleApiError(error: unknown): NextResponse<ApiResponse<null>> {
  // Safe error logging
  try {
    console.error('API Error:', String(error));
  } catch {
    console.error('API Error occurred (could not stringify)');
  }
  
  if (error instanceof ZodError) {
    return validationErrorResponse(error);
  }
  
  if (error instanceof Error) {
    // Check for specific Postgres errors
    const message = error.message;
    
    if (message.includes('unique constraint')) {
      return errorResponse('A record with this value already exists', 409);
    }
    
    if (message.includes('foreign key constraint')) {
      return errorResponse('Referenced record does not exist', 400);
    }
    
    if (message.includes('check constraint')) {
      if (message.includes('stock') || message.includes('quantity')) {
        return errorResponse('Insufficient stock for this operation', 400);
      }
      return errorResponse('Data validation failed', 400);
    }
    
    // Don't expose internal errors in production
    if (process.env.NODE_ENV === 'production') {
      return errorResponse('An internal error occurred', 500);
    }
    
    return errorResponse(message, 500);
  }
  
  return errorResponse('An unknown error occurred', 500);
}

// ─────────────────────────────────────────────
// ORDER NUMBER GENERATION
// ─────────────────────────────────────────────
export function generateOrderNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${year}${month}${day}-${random}`;
}

// ─────────────────────────────────────────────
// ALIASES FOR CONVENIENCE
// ─────────────────────────────────────────────
export const apiResponse = successResponse;
export const apiError = errorResponse;

export function getPaginationParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '50')));
  const offset = (page - 1) * limit;
  const sortBy = searchParams.get('sort_by') || 'id';
  const sortOrder = searchParams.get('sort_order') === 'desc' ? 'DESC' : 'ASC';
  
  return { page, limit, offset, sortBy, sortOrder };
}
