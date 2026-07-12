import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Dev/local seed accounts (idempotent insert).
 * Password for both: Password123!
 */
export class SeedDevUsers1730600000000 implements MigrationInterface {
  name = 'SeedDevUsers1730600000000';

  // argon2id hash of "Password123!"
  private readonly passwordHash =
    '$argon2id$v=19$m=65536,t=3,p=4$1ogmBWojFZMXuuo6yv6keg$LYPBU2vXU0XFKhW2qEtwZ5kGgIz0N1NdQXYr81OGS98';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      INSERT INTO "users" ("email", "password_hash", "display_name", "role")
      VALUES ($1, $2, $3, $4::"users_role_enum")
      ON CONFLICT ("email") DO NOTHING
      `,
      [
        'admin@playground.local',
        this.passwordHash,
        'Dev Admin',
        'admin',
      ],
    );

    await queryRunner.query(
      `
      INSERT INTO "users" ("email", "password_hash", "display_name", "role")
      VALUES ($1, $2, $3, $4::"users_role_enum")
      ON CONFLICT ("email") DO NOTHING
      `,
      [
        'user@playground.local',
        this.passwordHash,
        'Dev Learner',
        'user',
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      DELETE FROM "users"
      WHERE "email" IN ($1, $2)
      `,
      ['admin@playground.local', 'user@playground.local'],
    );
  }
}
