// ORDERZ-SEC: Disabled in production
// This endpoint could clear all stock data.
// Use DB migrations for stock initialization.
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: 'Endpoint disabled' }, { status: 410 }
  );
}
export async function POST() {
  return NextResponse.json(
    { error: 'Endpoint disabled' }, { status: 410 }
  );
}
export async function DELETE() {
  return NextResponse.json(
    { error: 'Endpoint disabled' }, { status: 410 }
  );
}
