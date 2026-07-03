import { existsSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';

/**
 * Resolve .env from project root whether running from cwd or compiled dist/.
 */
export function loadMonorepoEnv(): void {
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(__dirname, '../../.env'),
  ];

  const envPath = candidates.find((path) => existsSync(path));
  if (envPath) {
    config({ path: envPath });
  }
}
