// Frontend client for the Blocks API: `import { api } from 'aws-blocks'` resolves
// here in browser / React Server Component bundles, with types from ./index.ts.
//
// - API URL: NEXT_PUBLIC_BLOCKS_API_URL if set (e.g. the local dev server),
//   otherwise `custom.blocks_api_url` from amplify_outputs.json.
// - Every call carries the signed-in user's Cognito ID token as a bearer token.
//
// When you add another ApiNamespace export to ./index.ts, export a matching
// client here: `export const foo = ApiNamespaceClient('foo', { url: BLOCKS_API_URL });`
//
// (./client.js is a different file: the Blocks dev server regenerates it on every
// start, so it is git-ignored and not used by the frontend.)

import { ApiNamespaceClient, registerMiddleware } from '@aws-blocks/blocks/client';
import { fetchAuthSession } from 'aws-amplify/auth';
import outputs from '../amplify_outputs.json';

const BLOCKS_API_URL = process.env.NEXT_PUBLIC_BLOCKS_API_URL || outputs.custom?.blocks_api_url;
if (!BLOCKS_API_URL) {
  throw new Error(
    'Blocks API URL not found. Run `pnpm sandbox` (or deploy) to generate amplify_outputs.json.',
  );
}

registerMiddleware({
  async onRequest(req) {
    const { tokens } = await fetchAuthSession();
    const idToken = tokens?.idToken?.toString();
    if (idToken) req.headers['Authorization'] = `Bearer ${idToken}`;
    return req;
  },
});

export const api = ApiNamespaceClient('api', { url: BLOCKS_API_URL });
