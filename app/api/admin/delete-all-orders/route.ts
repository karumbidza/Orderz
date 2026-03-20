// ORDERZ-SEC: Disabled in production
import { NextResponse } from 'next/server';

export async function DELETE() {
  return NextResponse.json(
    { error: 'Endpoint disabled' }, { status: 410 }
  );
}
