import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { addBlocks } from './blocks.js';

const backend = defineBackend({
  auth,
});

// Adds the AWS Blocks API (Lambda + API Gateway + Aurora PostgreSQL) as a
// nested stack. See amplify/blocks.ts.
await addBlocks(backend);
