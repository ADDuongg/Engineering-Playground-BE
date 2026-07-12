import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backfill Index Playground guided-step payloads with recommended SQL/DDL
 * so learner summary exposes Apply content per step (enhancement to 022).
 * Idempotent: only updates rows where payload IS NULL.
 */
export class BackfillIndexPlaygroundStepSqlPayloads1730900000000
  implements MigrationInterface
{
  name = 'BackfillIndexPlaygroundStepSqlPayloads1730900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const labs: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM labs WHERE slug = 'index-playground' LIMIT 1`,
    );
    if (labs.length === 0) {
      return;
    }
    const labId = labs[0].id;

    const recommendedQuery = {
      sql: 'SELECT id, email, name FROM users WHERE email = $1',
      exampleParameters: ['user1@example.com'],
      paramHints: [
        'Pass parameters: ["user1@example.com"] (or any email that exists in the commerce seed). Do not run with an empty parameters array.',
      ],
      description:
        'Selective equality lookup on users.email (unindexed in baseline schema) to demonstrate seq scan vs index scan.',
    };

    const queryPayload = JSON.stringify({ recommendedQuery });
    const createPayload = JSON.stringify({
      sql: 'CREATE INDEX idx_users_email ON users (email)',
    });
    const dropPayload = JSON.stringify({
      sql: 'DROP INDEX idx_users_email',
    });

    await queryRunner.query(
      `
      UPDATE lab_guided_steps
      SET payload = $2::jsonb, updated_at = NOW()
      WHERE lab_id = $1
        AND display_order = ANY($3::int[])
        AND payload IS NULL
      `,
      [labId, queryPayload, [1, 2, 4, 5]],
    );

    await queryRunner.query(
      `
      UPDATE lab_guided_steps
      SET payload = $2::jsonb, updated_at = NOW()
      WHERE lab_id = $1
        AND display_order = 3
        AND payload IS NULL
      `,
      [labId, createPayload],
    );

    await queryRunner.query(
      `
      UPDATE lab_guided_steps
      SET payload = $2::jsonb, updated_at = NOW()
      WHERE lab_id = $1
        AND display_order = 7
        AND payload IS NULL
      `,
      [labId, dropPayload],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const labs: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM labs WHERE slug = 'index-playground' LIMIT 1`,
    );
    if (labs.length === 0) {
      return;
    }
    const labId = labs[0].id;
    await queryRunner.query(
      `
      UPDATE lab_guided_steps
      SET payload = NULL, updated_at = NOW()
      WHERE lab_id = $1
        AND display_order = ANY($2::int[])
      `,
      [labId, [1, 2, 3, 4, 5, 7]],
    );
  }
}
