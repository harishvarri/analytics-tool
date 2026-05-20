import 'server-only';
import { randomUUID } from 'node:crypto';
import type { NextResponse, NextRequest } from 'next/server';
import { AppError } from './errors';
import { fail } from './response';
import { scoped } from '../logger';

const log = scoped('api');

export type RouteContext<P = Record<string, string>> = { params: Promise<P> };

export type ApiHandler<P = Record<string, string>> = (
  req: NextRequest,
  ctx: RouteContext<P>,
) => Promise<NextResponse> | NextResponse;

/**
 * Wraps an API route to provide:
 *  - centralized error handling (AppError → typed envelope)
 *  - request logging with a stable request id stamped in response headers
 *  - guaranteed JSON envelope shape
 *
 * Request id propagation: callers can send `x-request-id`; otherwise we
 * mint one. Either way the id is reflected back so client logs correlate
 * with server logs.
 */
export function withApiHandler<P = Record<string, string>>(handler: ApiHandler<P>): ApiHandler<P> {
  return async (req, ctx) => {
    const start = Date.now();
    const route = req.nextUrl.pathname;
    const requestId = req.headers.get('x-request-id') ?? randomUUID();
    try {
      const res = await handler(req, ctx);
      res.headers.set('x-request-id', requestId);
      log.info(
        { requestId, route, method: req.method, status: res.status, ms: Date.now() - start },
        'request',
      );
      return res;
    } catch (err) {
      const ms = Date.now() - start;
      if (err instanceof AppError) {
        log.warn(
          { requestId, route, method: req.method, code: err.code, status: err.status, ms },
          err.message,
        );
        const res = fail(err.code, err.message, err.status, err.details);
        res.headers.set('x-request-id', requestId);
        return res;
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      log.error({ requestId, route, method: req.method, err: message, ms }, 'unhandled error');
      const res = fail('INTERNAL_ERROR', 'Internal server error', 500);
      res.headers.set('x-request-id', requestId);
      return res;
    }
  };
}
