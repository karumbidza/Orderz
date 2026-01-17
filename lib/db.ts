import { neon } from '@neondatabase/serverless';

// Create SQL query function
const sql = neon(process.env.DATABASE_URL!);

export { sql };

// Types for database operations
export type QueryResult<T> = T[];

// Helper for transactions (Neon serverless doesn't support traditional transactions,
// but we can batch queries)
export async function batchQueries<T>(queries: string[]): Promise<T[]> {
  const results: T[] = [];
  for (const query of queries) {
    const result = await sql(query);
    results.push(result as T);
  }
  return results;
}

// Health check
export async function checkConnection(): Promise<boolean> {
  try {
    await sql`SELECT 1 as connected`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}
