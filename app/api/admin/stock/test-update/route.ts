// ORDERZ-SEC: Test endpoint disabled in production
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Test endpoint disabled' }, { status: 410 }
  );
}
