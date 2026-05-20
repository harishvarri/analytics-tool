export interface Logger {
  debug: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

const noop = () => {};

export function createLogger(debug: boolean): Logger {
  if (!debug) return { debug: noop, warn: noop, error: noop };
  const prefix = '[ncpl-analytics]';
  return {
    debug: (...a) => console.debug(prefix, ...a),
    warn: (...a) => console.warn(prefix, ...a),
    error: (...a) => console.error(prefix, ...a),
  };
}
