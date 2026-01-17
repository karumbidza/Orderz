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
  meta?: { total?: number; page?: number; limit?: number }
): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
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
  
  // In development, allow requests without API key
  if (process.env.NODE_ENV === 'development' && !validKey) {
    return true;
  }
  
  return apiKey === validKey;
}

export function requireAuth(request: NextRequest): NextResponse | null {
  if (!validateApiKey(request)) {
    return errorResponse('Unauthorized: Invalid or missing API key', 401);
  }
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
  console.error('API Error:', error);
  
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
