/**
 * Verifies the Cognito ID token that the frontend sends as
 * `Authorization: Bearer <token>` (see aws-blocks/client.js).
 *
 * The User Pool is owned by Amplify (amplify/auth/resource.ts); its IDs reach
 * this runtime as COGNITO_USER_POOL_ID / COGNITO_CLIENT_ID (see amplify/blocks.ts).
 */
import { ApiError, type BlocksContext } from '@aws-blocks/blocks';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

export interface User {
  /** Stable user ID (Cognito `sub`). Use this as the owner key for data. */
  sub: string;
  email?: string;
  groups: string[];
}

let verifier: ReturnType<typeof createVerifier> | undefined;

function createVerifier() {
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;
  if (!userPoolId || !clientId) {
    throw new ApiError('Auth is not configured (COGNITO_USER_POOL_ID / COGNITO_CLIENT_ID)', 500);
  }
  return CognitoJwtVerifier.create({ userPoolId, clientId, tokenUse: 'id' });
}

/** Returns the signed-in user, or null when the token is missing or invalid. */
export async function getUser(context: BlocksContext): Promise<User | null> {
  const header = context.request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;

  verifier ??= createVerifier();
  try {
    const payload = await verifier.verify(header.slice('Bearer '.length));
    return {
      sub: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      groups: payload['cognito:groups'] ?? [],
    };
  } catch {
    return null;
  }
}

/** Returns the signed-in user, or throws 401. */
export async function requireUser(context: BlocksContext): Promise<User> {
  const user = await getUser(context);
  if (!user) throw new ApiError('Unauthorized', 401);
  return user;
}
