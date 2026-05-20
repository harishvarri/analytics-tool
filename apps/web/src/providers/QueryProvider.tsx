'use client';

import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { makeQueryClient } from '@/lib/query-client';

let browserClient: QueryClient | undefined;

function getClient(): QueryClient {
  if (typeof window === 'undefined') return makeQueryClient(); // SSR: always new
  if (!browserClient) browserClient = makeQueryClient(); // CSR: singleton
  return browserClient;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(getClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
