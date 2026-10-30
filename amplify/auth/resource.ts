import { defineAuth } from '@aws-amplify/backend';

/**
 * Cognito User Pool used by both the Amplify Authenticator UI and the
 * Blocks API (which verifies the ID token sent as a bearer token).
 * @see https://docs.amplify.aws/react/build-a-backend/auth/
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
});
