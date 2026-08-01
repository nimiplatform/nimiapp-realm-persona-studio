import type { JsonValue } from '../../bridge/index.js';

export type RendererLogLevel = 'info' | 'warn' | 'error';

export type RendererLogEvent = {
  level: RendererLogLevel;
  area: string;
  message: string;
  flowId?: string;
  details?: JsonValue;
};

export function describeError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: 'NonError', message: String(error) };
}

/**
 * Keeps renderer diagnostics local to the Desktop-supervised App renderer.
 * Apps do not get a raw logging IPC capability.
 */
export function logRendererEvent(event: RendererLogEvent): void {
  const consoleMethod = event.level === 'error' ? 'error' : event.level === 'warn' ? 'warn' : 'info';
  globalThis.console?.[consoleMethod]?.(`[realm-persona-studio:${event.area}] ${event.message}`, event.details ?? null);
}

let installed = false;

export function installStudioGlobalErrorLogging(): void {
  if (installed) return;
  installed = true;
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    logRendererEvent({
      level: 'error',
      area: 'renderer.window.onerror',
      message: 'window.onerror',
      details: {
        error: describeError(event.error || event.message),
        source: event.filename,
        line: event.lineno,
        column: event.colno,
      },
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logRendererEvent({
      level: 'error',
      area: 'renderer.window.unhandledrejection',
      message: 'window.unhandledrejection',
      details: { reason: describeError(event.reason) },
    });
  });
}
