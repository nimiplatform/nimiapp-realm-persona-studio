import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STUDIO_REALM_SURFACE_METHODS } from './realm-client.js';

const PORTFOLIO_REALM_CONSUMERS = [
  'portfolio-client.ts',
  'portfolio-media-client.ts',
  'portfolio-post-client.ts',
  'portfolio-settings-client.ts',
] as const;

describe('studio Realm facade boundary', () => {
  it('exposes only the admitted Studio Realm surface methods', () => {
    expect([...STUDIO_REALM_SURFACE_METHODS]).toEqual([
      'worldCoreControllerListRealmPersonas',
      'worldCoreControllerGetRealmPersona',
      'worldCoreControllerCreateRealmPersona',
      'worldCoreControllerReplaceRealmPersona',
      'worldCoreControllerListWorldCores',
      'worldCoreControllerGetWorldCore',
      'worldCoreControllerGetOasisWorld',
      'worldCoreControllerCreateSourceMaterializationPacket',
    ]);
  });

  it('keeps portfolio feature clients off Realm.generated', () => {
    for (const fileName of PORTFOLIO_REALM_CONSUMERS) {
      const source = readFileSync(
        join(process.cwd(), 'src/shell/renderer/features/portfolio', fileName),
        'utf8',
      );
      expect(source).not.toContain('.generated.');
      expect(source).not.toContain("Pick<Realm, 'generated'>");
      expect(source).not.toContain('import type { Realm }');
      expect(source).not.toContain('CreateRuntimeSourceSnapshot');
      expect(source).not.toContain('RuntimeSourceSnapshot');
      expect(source).not.toContain('createRuntimeSourceSnapshot');
    }
  });
});
