export type StudioProtectedSessionState =
  | 'action-required'
  | 'runtime-unavailable'
  | 'access-denied'
  | 'session-ended'
  | 'repair-required'
  | 'capability-unavailable';

export type StudioProtectedSessionFailure = {
  readonly state: StudioProtectedSessionState;
  readonly reasonCode?: string;
  readonly actionHint?: string;
  readonly message: string;
};

const ACTION_REQUIRED_REASONS = new Set([
  'account-authentication-required',
  'runtime-account-authentication-required',
  'runtime-unauthenticated',
  'local-app-owner-unavailable',
]);

const RUNTIME_UNAVAILABLE_REASONS = new Set([
  'runtime-service-unavailable',
  'runtime-service-not-running',
  'runtime-connection-unavailable',
  'presence-expired',
]);

const ACCESS_DENIED_REASONS = new Set([
  'local-app-access-denied',
  'runtime-access-denied',
  'local-app-operation-unavailable',
  'local-app-operation-unsupported',
  'local-app-snapshot-unavailable',
]);

const SESSION_ENDED_REASONS = new Set([
  'revoked',
  'account-changed',
  'project-changed',
  'local-development-project-changed',
  'process-replaced',
  'runtime-restarted',
]);

const REPAIR_REQUIRED_REASONS = new Set([
  'protected-carrier-required',
  'runtime-service-repair-required',
  'runtime-service-untrusted',
  'runtime-service-error-unclassified',
  'protected-peer-untrusted',
  'SDK_LOCAL_APP_CARRIER_REQUIRED',
  'SDK_LOCAL_APP_PROJECTION_INVALID',
  'renderer-standard-shell-host-unavailable',
  'renderer-standard-shell-result-invalid',
]);

export function classifyStudioProtectedSessionFailure(
  error: unknown,
): StudioProtectedSessionFailure {
  const direct = asRecord(error);
  const message = messageFrom(error);
  const embedded = parseEmbeddedError(message);
  const reasonCode = firstText(
    direct?.reasonCode,
    direct?.code,
    embedded?.reasonCode,
    embedded?.code,
  );
  const actionHint = firstText(
    direct?.actionHint,
    embedded?.actionHint,
  );

  return {
    state: stateFor(reasonCode),
    ...(reasonCode ? { reasonCode } : {}),
    ...(actionHint ? { actionHint } : {}),
    message,
  };
}

function stateFor(reasonCode: string): StudioProtectedSessionState {
  if (ACTION_REQUIRED_REASONS.has(reasonCode)) return 'action-required';
  if (RUNTIME_UNAVAILABLE_REASONS.has(reasonCode)) return 'runtime-unavailable';
  if (ACCESS_DENIED_REASONS.has(reasonCode)) return 'access-denied';
  if (SESSION_ENDED_REASONS.has(reasonCode)) return 'session-ended';
  if (REPAIR_REQUIRED_REASONS.has(reasonCode)) return 'repair-required';
  return 'capability-unavailable';
}

function messageFrom(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  const record = asRecord(error);
  return firstText(record?.message, record?.reasonCode, record?.code)
    || 'The protected Realm Persona Studio operation set is unavailable.';
}

function parseEmbeddedError(message: string): Record<string, unknown> | undefined {
  try {
    return asRecord(JSON.parse(message) as unknown);
  } catch {
    return undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function firstText(...values: readonly unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}
