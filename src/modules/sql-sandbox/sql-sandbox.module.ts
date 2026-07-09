import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PlaygroundDatabaseModule } from '../../database/playground/playground-database.module';
import { ValidateSqlStatementService } from './application/validate-sql-statement.service';
import { ExecuteSandboxedSqlUseCase } from './application/execute-sandboxed-sql.usecase';
import { SqlSandboxController } from './sql-sandbox.controller';
import {
  DEFAULT_SANDBOX_CONFIG,
  SANDBOX_CONFIG,
  SandboxConfig,
} from './config/sandbox.config';

function buildSandboxConfig(configService: ConfigService): SandboxConfig {
  return {
    queryTimeoutMs: configService.get<number>(
      'sandbox.queryTimeoutMs',
      DEFAULT_SANDBOX_CONFIG.queryTimeoutMs,
    ),
    policyVersion: configService.get<string>(
      'sandbox.policyVersion',
      DEFAULT_SANDBOX_CONFIG.policyVersion,
    ),
    maxRows: configService.get<number>(
      'sandbox.maxRows',
      DEFAULT_SANDBOX_CONFIG.maxRows,
    ),
    allowedStatementKinds: DEFAULT_SANDBOX_CONFIG.allowedStatementKinds,
  };
}

@Module({
  imports: [ConfigModule, PlaygroundDatabaseModule],
  controllers: [SqlSandboxController],
  providers: [
    {
      provide: SANDBOX_CONFIG,
      inject: [ConfigService],
      useFactory: buildSandboxConfig,
    },
    ValidateSqlStatementService,
    ExecuteSandboxedSqlUseCase,
  ],
  exports: [ExecuteSandboxedSqlUseCase, ValidateSqlStatementService],
})
export class SqlSandboxModule {}
