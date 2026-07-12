import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLabStatusAndBackfill1730700000000
  implements MigrationInterface
{
  name = 'AddLabStatusAndBackfill1730700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "labs_status_enum" AS ENUM ('active', 'coming-soon')
    `);

    await queryRunner.query(`
      ALTER TABLE "labs"
      ADD COLUMN "status" "labs_status_enum" NOT NULL DEFAULT 'active'
    `);

    await queryRunner.query(`
      UPDATE "labs" SET "status" = 'active'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "labs" DROP COLUMN "status"
    `);
    await queryRunner.query(`
      DROP TYPE "labs_status_enum"
    `);
  }
}
