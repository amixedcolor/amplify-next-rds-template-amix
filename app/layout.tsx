import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AmplifyProvider } from './amplify-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Amplify Gen 2 + RDS Template',
  description: 'Next.js + Amplify Gen 2 (Cognito) + AWS Blocks (Aurora PostgreSQL)',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AmplifyProvider>{children}</AmplifyProvider>
      </body>
    </html>
  );
}
