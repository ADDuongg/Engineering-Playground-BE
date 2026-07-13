import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Consolidates the frontend track onto `frontend-react` (which carries the
 * React Fundamentals labs) and removes the empty `frontend-performance`
 * placeholder seeded by InitTracksTable.
 *
 * Safe: only deletes `frontend-performance` when no labs reference it.
 * Reorders `frontend-react` to display_order 3 to close the gap.
 */
export class RemoveFrontendPerformancePlaceholderTrack1731200000000
  implements MigrationInterface
{
  name = 'RemoveFrontendPerformancePlaceholderTrack1731200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      DELETE FROM "tracks" t
      WHERE t.slug = 'frontend-performance'
        AND NOT EXISTS (SELECT 1 FROM "labs" l WHERE l.track_id = t.id)
      `,
    );

    await queryRunner.query(
      `UPDATE "tracks" SET "display_order" = 3, "updated_at" = now() WHERE "slug" = 'frontend-react'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "tracks" SET "display_order" = 4, "updated_at" = now() WHERE "slug" = 'frontend-react'`,
    );

    await queryRunner.query(`
      INSERT INTO "tracks" (
        "slug", "name", "description", "status", "display_order",
        "runtime_adapter_type", "input_surface_type",
        "metric_catalog_id", "visualization_kit_id"
      ) VALUES (
        'frontend-performance',
        'Frontend Performance',
        'Understand React rendering, browser paint, bundle size, and network optimization.',
        'coming-soon',
        3,
        'headless_react_sandbox',
        'component_sandbox',
        'react-metrics',
        'react-viz'
      )
      ON CONFLICT ("slug") DO NOTHING
    `);
  }
}
