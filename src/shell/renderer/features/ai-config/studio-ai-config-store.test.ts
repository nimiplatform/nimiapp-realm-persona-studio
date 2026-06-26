import { describe, expect, it } from 'vitest';
import { encodeNimiAIScopeRef } from '@nimiplatform/sdk/ai';
import {
  STUDIO_AI_CONFIG_STORAGE_INDEX_KEY,
  STUDIO_AI_CONFIG_STORAGE_PREFIX,
  STUDIO_AI_CONFIG_QUARANTINE_PREFIX,
  createStudioAIScopeRef,
  repairStudioAIConfigStorageForScope,
} from './studio-ai-config-store.js';

function createMemoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear() {
      items.clear();
    },
    getItem(key: string) {
      return items.has(key) ? items.get(key)! : null;
    },
    key(index: number) {
      return [...items.keys()][index] ?? null;
    },
    removeItem(key: string) {
      items.delete(key);
    },
    setItem(key: string, value: string) {
      items.set(key, String(value));
    },
  };
}

describe('studio-ai-config-store repair', () => {
  it('quarantines stored AIConfig refs that predate Runtime Target Identity v2', () => {
    const storage = createMemoryStorage();
    const scopeRef = createStudioAIScopeRef();
    const scopeKey = encodeNimiAIScopeRef(scopeRef);
    const storageKey = `${STUDIO_AI_CONFIG_STORAGE_PREFIX}${scopeKey}:v1`;
    const raw = JSON.stringify({
      scopeRef,
      capabilities: {
        targetRefs: {
          'image.generate': {
            kind: 'local-runtime',
            targetId: 'local-image',
            profileId: 'runtime-baseline:image',
          },
        },
        selectedParams: {},
      },
      profileOrigin: null,
    });
    storage.setItem(STUDIO_AI_CONFIG_STORAGE_INDEX_KEY, JSON.stringify([scopeKey]));
    storage.setItem(storageKey, raw);

    const result = repairStudioAIConfigStorageForScope(scopeRef, storage, {
      now: () => '2026-06-26T00:00:00.000Z',
    });

    expect(result).toMatchObject({
      scanned: 1,
      quarantined: 1,
      removedScopeKeys: [scopeKey],
    });
    expect(storage.getItem(storageKey)).toBeNull();
    expect(JSON.parse(storage.getItem(STUDIO_AI_CONFIG_STORAGE_INDEX_KEY) || 'null')).toEqual([]);
    expect(result.quarantineKeys).toHaveLength(1);
    expect(result.quarantineKeys[0]).toMatch(new RegExp(`^${STUDIO_AI_CONFIG_QUARANTINE_PREFIX}`));
    expect(JSON.parse(storage.getItem(result.quarantineKeys[0]!) || '{}')).toMatchObject({
      reasonCode: 'STUDIO_AI_CONFIG_STORE_INVALID',
      raw,
    });
  });
});
