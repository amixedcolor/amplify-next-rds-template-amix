/**
 * Local Blocks dev server (`pnpm blocks:dev`): runs aws-blocks/index.ts on
 * http://localhost:3001 with a local PGlite database (.bb-data/).
 *
 * Auth still uses your sandbox's Cognito User Pool, read from amplify_outputs.json,
 * so run `pnpm sandbox` once first. Point the frontend here with
 * NEXT_PUBLIC_BLOCKS_API_URL=http://localhost:3001/aws-blocks/api (see .env.example).
 */
import { startDevServer } from '@aws-blocks/blocks/scripts';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputsPath = join(__dirname, '..', '..', 'amplify_outputs.json');

if (existsSync(outputsPath)) {
  const outputs = JSON.parse(readFileSync(outputsPath, 'utf8'));
  process.env.COGNITO_USER_POOL_ID ??= outputs.auth?.user_pool_id;
  process.env.COGNITO_CLIENT_ID ??= outputs.auth?.user_pool_client_id;
} else {
  console.warn('amplify_outputs.json not found — run `pnpm sandbox` first. Authenticated calls will fail.');
}

startDevServer({
  backendPath: join(__dirname, '..', 'index.ts'),
  port: 3001,
});
