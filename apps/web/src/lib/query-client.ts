import { QueryClient } from '@tanstack/react-query';

/**
 * QueryClient factory. Per-request on the server, per-app on the client.
 * Conservative defaults — long stale time for analytics aggregates, no refetch on focus.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
      mutations: { retry: 0 },
    },
  });
}
