import type { NimiLocalAppClient } from '@nimiplatform/sdk/app';
import { getStudioLocalAppClient } from './studio-platform.js';

export type StudioProtectedJsonStorage = Pick<
  NimiLocalAppClient['storage'],
  'readJson' | 'writeJson' | 'removeJson'
>;

export function getStudioProtectedJsonStorage(): StudioProtectedJsonStorage {
  return getStudioLocalAppClient().storage;
}

export function isStudioStorageNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as Record<string, unknown>;
  if (record.code === 'not-found') return true;
  return typeof record.reasonCode === 'string'
    && record.reasonCode.toLowerCase().includes('storage-json-not-found');
}
