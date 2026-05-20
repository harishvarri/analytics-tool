import type { ReactNode } from 'react';
import { Providers } from './providers';
import { getCurrentUser } from '@/lib/auth'; // your portal's auth helper

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser(); // server-resolved session

  return (
    <html lang="en">
      <body>
        <Providers user={user}>{children}</Providers>
      </body>
    </html>
  );
}
