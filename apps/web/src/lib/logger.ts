import 'server-only';
import pino, { type Logger } from 'pino';
import { env } from './env';

const isDev = env.NODE_ENV !== 'production';

export const logger: Logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'ncpl-analytics-web' },
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname' },
        },
      }
    : {}),
});

export function scoped(scope: string, meta: Record<string, unknown> = {}): Logger {
  return logger.child({ scope, ...meta });
}
