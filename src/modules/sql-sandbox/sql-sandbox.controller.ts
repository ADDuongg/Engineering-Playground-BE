import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { ExecuteSandboxedSqlUseCase } from './application/execute-sandboxed-sql.usecase';
import { ValidateSqlStatementService } from './application/validate-sql-statement.service';
import { SandboxExecuteDto } from './dto/sandbox-execute.dto';

@ApiTags('sql-sandbox')
@ApiBearerAuth()
@Controller('sql/sandbox')
export class SqlSandboxController {
  constructor(
    private readonly executeSandboxedSql: ExecuteSandboxedSqlUseCase,
    private readonly validateSqlStatement: ValidateSqlStatementService,
  ) {}

  @Post('execute')
  @ApiOperation({ summary: 'Execute SQL in the playground sandbox' })
  async execute(
    @Body() dto: SandboxExecuteDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.executeSandboxedSql.execute({
      sql: dto.sql,
      parameters: dto.parameters,
      context: {
        requestId: req.headers['x-request-id'] as string | undefined,
        trackSlug: dto.context?.trackSlug,
        labSlug: dto.context?.labSlug,
        userId: user.sub,
      },
    });
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate SQL against sandbox policy without executing' })
  validate(@Body() dto: SandboxExecuteDto) {
    return this.validateSqlStatement.validate(dto.sql, dto.parameters);
  }
}
