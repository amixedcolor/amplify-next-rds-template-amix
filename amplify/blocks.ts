import type { Backend } from '@aws-amplify/backend';
import { registerConfig } from '@aws-blocks/blocks/cdk';
import { createBlocksBackend } from '../aws-blocks/index.cdk.js';
import type { auth } from './auth/resource.js';

/**
 * Wires the AWS Blocks backend (aws-blocks/) into Amplify Gen 2 as a nested stack.
 *
 * - Passes the Cognito User Pool to the Blocks runtime so it can verify bearer tokens.
 * - Allows CORS from this app's Amplify Hosting domains.
 * - Publishes the Blocks API URL to amplify_outputs.json (`custom.blocks_api_url`).
 */
export async function addBlocks(backend: Backend<{ auth: typeof auth }>) {
  const stack = backend.createStack('blocks');
  // Set by `pnpm sandbox` / `pnpm sandbox:delete` (package.json). Amplify has no
  // documented way to detect a sandbox deployment from backend code.
  const sandboxMode = process.env.AMPLIFY_SANDBOX === 'true';

  const blocks = await createBlocksBackend(stack, {
    sandboxMode,
    allowedOrigins: allowedOrigins(sandboxMode),
  });

  const { cfnUserPool, cfnUserPoolClient } = backend.auth.resources.cfnResources;
  registerConfig(blocks, 'COGNITO_USER_POOL_ID', cfnUserPool.ref);
  registerConfig(blocks, 'COGNITO_CLIENT_ID', cfnUserPoolClient.ref);

  backend.addOutput({
    custom: {
      blocks_api_url: blocks.publicApiUrl,
    },
  });
}

/**
 * CORS origins (regular expressions) the Blocks API accepts.
 *
 * - Sandbox: the Blocks sandbox preset already allows http://localhost:*.
 * - Amplify Hosting: AWS_APP_ID is set in the Amplify build environment, so every
 *   branch of this app (https://<branch>.<appId>.amplifyapp.com) is allowed.
 * - Custom domains: set BLOCKS_ALLOWED_ORIGINS (comma-separated regexes) as an
 *   Amplify Hosting environment variable, e.g. `^https://app\.example\.com$`.
 *   Patterns must not contain commas (e.g. `{1,3}`): Blocks also joins and
 *   splits origins on commas.
 */
function allowedOrigins(sandboxMode: boolean): string[] {
  const origins: string[] = [];
  const appId = process.env.AWS_APP_ID;
  if (appId && !sandboxMode) {
    origins.push(`^https://[a-zA-Z0-9-]+\\.${appId}\\.amplifyapp\\.com$`);
  }
  const extra = process.env.BLOCKS_ALLOWED_ORIGINS;
  if (extra) {
    origins.push(...extra.split(',').map((o) => o.trim()).filter(Boolean));
  }
  return origins;
}
