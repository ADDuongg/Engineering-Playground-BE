/**
 * Stable Index Playground SQL constants for tests + migrations.
 * Keep in sync with lab-flow seed / backfill migrations.
 */
export const INDEX_PLAYGROUND_SEED = {
  slug: 'index-playground',
  recommendedQuery: {
    sql: 'SELECT id, email, name FROM users WHERE email = $1',
    exampleParameters: ['user1@example.com'] as unknown[],
    paramHints: [
      'Pass parameters: ["user1@example.com"] (or any email that exists in the commerce seed). Do not run with an empty parameters array.',
    ],
    description:
      'Selective equality lookup on users.email (unindexed in baseline schema) to demonstrate seq scan vs index scan.',
  },
  recommendedCreateIndexSql: 'CREATE INDEX idx_users_email ON users (email)',
  recommendedDropIndexSql: 'DROP INDEX idx_users_email',
} as const;

/** Payload JSON for Index Playground guided steps (by display_order). */
export function indexPlaygroundStepPayload(
  displayOrder: number,
): Record<string, unknown> | null {
  const q = INDEX_PLAYGROUND_SEED.recommendedQuery;
  switch (displayOrder) {
    case 1:
    case 2:
    case 4:
    case 5:
      return { recommendedQuery: { ...q, exampleParameters: [...q.exampleParameters], paramHints: [...q.paramHints] } };
    case 3:
      return { sql: INDEX_PLAYGROUND_SEED.recommendedCreateIndexSql };
    case 7:
      return { sql: INDEX_PLAYGROUND_SEED.recommendedDropIndexSql };
    default:
      return null;
  }
}
