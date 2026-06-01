import 'server-only';
import pino, { type Logger } from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger: Logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
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
