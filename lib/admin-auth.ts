// ORDERZ-SEC
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

/**
 * Validates Clerk session for admin API routes.
 * Returns null if valid, NextResponse error if not.
 */
export async function requireAdminAuth(): Promise<NextResponse | null> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    return null; // authenticated
  } catch (err) {
    return NextResponse.json(
      { error: 'Authentication error' },
      { status: 401 }
    );
  }
}
