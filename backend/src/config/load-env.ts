import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(__dirname, '../../../.env');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}
