import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserUpdatedBy1731000000000 implements MigrationInterface {
  name = 'AddUserUpdatedBy1731000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "updated_by" uuid NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "FK_users_updated_by"
      FOREIGN KEY ("updated_by") REFERENCES "users"("id")
      ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP CONSTRAINT "FK_users_updated_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN "updated_by"
    `);
  }
}
