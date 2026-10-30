/**
 * CDK entry point for the Blocks backend.
 *
 * Not a standalone CDK app: amplify/blocks.ts calls createBlocksBackend() with a
 * stack created by Amplify, and `ampx` drives synthesis and deployment.
 */
import { BlocksBackend, BlocksPresets } from '@aws-blocks/blocks/cdk';
import type { Stack } from 'aws-cdk-lib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface BlocksBackendOptions {
  /** `ampx sandbox`: resources are destroyed with the sandbox, no deletion protection. */
  sandboxMode: boolean;
  /** Extra CORS origins (regular expressions) on top of the preset's. */
  allowedOrigins: string[];
}

export async function createBlocksBackend(stack: Stack, options: BlocksBackendOptions) {
  // Building Blocks read this context key to detect sandbox deployments.
  if (options.sandboxMode) {
    stack.node.setContext('sandboxMode', 'true');
  }

  // Encrypt Aurora storage at rest. Blocks' own templates set this in cdk.json;
  // Amplify has no cdk.json, so set it here (for every environment).
  stack.node.setContext('@aws-blocks/bb-data:encryptStorageByDefault', true);

  const preset = options.sandboxMode ? BlocksPresets.sandbox : BlocksPresets.production;

  return BlocksBackend.create(stack, 'blocks', {
    backendHandlerPath: join(__dirname, 'index.handler.ts'),
    backendCDKPath: join(__dirname, 'index.ts'),
    defaults: {
      ...preset,
      allowedOrigins: [...preset.allowedOrigins, ...options.allowedOrigins],
    },
  });
}
