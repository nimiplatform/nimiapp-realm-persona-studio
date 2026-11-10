import type { NimiAppRuntimeClient } from '@nimiplatform/sdk/app';
import type { StudioScope } from './studio-scope.js';

export type StudioProtectedJsonStorage = Pick<
  NimiAppRuntimeClient['storage'],
  'readJson' | 'writeJson' | 'removeJson'
>;

const scopedStorage = new WeakMap<StudioScope, StudioProtectedJsonStorage>();
export function getStudioProtectedJsonStorage(scope: StudioScope): StudioProtectedJsonStorage {
  scope.signal.throwIfAborted();
  let storage = scopedStorage.get(scope);
  if (!storage) {
    const call = async <T,>(operation: () => Promise<T>): Promise<T> => {
      scope.signal.throwIfAborted();
      const result = await operation();
      scope.signal.throwIfAborted();
      return result;
    };
    const owner = scope.client.storage;
    storage = { readJson: path => call(() => owner.readJson(path)), writeJson: (path, value) => call(() => owner.writeJson(path, value)), removeJson: path => call(() => owner.removeJson(path)) };
    scopedStorage.set(scope, storage);
  }
  return storage;
}

export function isStudioStorageNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as Record<string, unknown>;
  if (record.code === 'not-found' || record.reasonCode === 'APP_STORAGE_ENTRY_NOT_FOUND') return true;
  return typeof record.reasonCode === 'string'
    && record.reasonCode.toLowerCase().includes('storage-json-not-found');
}
