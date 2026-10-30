'use client';

import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { Amplify } from 'aws-amplify';
import type { ReactNode } from 'react';
import outputs from '@/amplify_outputs.json';

Amplify.configure(outputs);

/** Configures Amplify and requires sign-in for every page. */
export function AmplifyProvider({ children }: { children: ReactNode }) {
  return <Authenticator>{children}</Authenticator>;
}
