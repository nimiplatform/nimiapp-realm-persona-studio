import type { StudioCopyKey } from '../../i18n/studio-copy.js';
import type { PortfolioFailureKind } from './portfolio-data.js';

const FAILURE_KIND_COPY_KEYS: Record<PortfolioFailureKind, StudioCopyKey> = {
  'capability-unavailable': 'failure.kind.capabilityUnavailable',
  'invalid-input': 'failure.kind.invalidInput',
  'session-invalid': 'failure.kind.sessionInvalid',
  'access-denied': 'failure.kind.accessDenied',
  'owner-authority-missing': 'failure.kind.ownerAuthorityMissing',
  'not-found': 'failure.kind.notFound',
  'content-conflict': 'failure.kind.contentConflict',
  'realm-unavailable': 'failure.kind.realmUnavailable',
  'rate-limited': 'failure.kind.rateLimited',
  'upstream-failed': 'failure.kind.upstreamFailed',
  'contract-invalid': 'failure.kind.contractInvalid',
  'request-too-large': 'failure.kind.requestTooLarge',
  'response-too-large': 'failure.kind.responseTooLarge',
};

/**
 * Maps a typed PersonaCharacter failure kind to its owner-readable copy key.
 * Raw failure-kind tokens must never be rendered to users; unknown values
 * fail closed to the generic key.
 */
export function failureKindCopyKey(kind: string): StudioCopyKey {
  return FAILURE_KIND_COPY_KEYS[kind as PortfolioFailureKind] ?? 'failure.kind.generic';
}
