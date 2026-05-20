import type { NextRequest } from 'next/server';
import type { z, ZodSchema } from 'zod';
import { ValidationError } from './errors';

interface ParseBodyOptions {
  /** Reject bodies larger than this many bytes. Default: no limit. */
  maxBytes?: number;
}

export async function parseBody<T>(
  req: NextRequest,
  schema: ZodSchema<T>,
  opts: ParseBodyOptions = {},
): Promise<T> {
  if (opts.maxBytes !== undefined) {
    const declared = Number(req.headers.get('content-length') ?? '0');
    if (Number.isFinite(declared) && declared > opts.maxBytes) {
      throw new ValidationError(`Body too large: ${declared} > ${opts.maxBytes} bytes`);
    }
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ValidationError('Request body must be valid JSON');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError('Invalid request body', flatten(parsed.error));
  }
  return parsed.data;
}

export function parseQuery<T>(req: NextRequest, schema: ZodSchema<T>): T {
  const obj = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = schema.safeParse(obj);
  if (!parsed.success) {
    throw new ValidationError('Invalid query parameters', flatten(parsed.error));
  }
  return parsed.data;
}

export function parseParams<T>(params: unknown, schema: ZodSchema<T>): T {
  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    throw new ValidationError('Invalid route parameters', flatten(parsed.error));
  }
  return parsed.data;
}

function flatten(err: z.ZodError): Record<string, string[]> {
  return err.flatten().fieldErrors as Record<string, string[]>;
}
