import { existsSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';

/**
 * Resolve .env from monorepo root regardless of whether the caller runs
 * from sql-play/, apps/api/, or via compiled dist/.
 */
export function loadMonorepoEnv(): void {
  const candidates = [
    resolve(process.cwd(), '../../.env'),
    resolve(process.cwd(), '.env'),
    resolve(__dirname, '../../../../../.env'),
    resolve(__dirname, '../../../../.env'),
  ];

  const envPath = candidates.find((path) => existsSync(path));
  if (envPath) {
    config({ path: envPath });
  }
}
