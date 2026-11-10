import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';

// Public-entry checks complement shared Kit lifecycle tests; they are not
// evidence of a live Host or an admitted website.
describe('Studio delegates identity and transport to the selected public Kit entry', () => {
  it('keeps Desktop bridge setup separate from the official Web account factory', () => {
    const read = (file: string) => readFileSync(join(process.cwd(), 'src/shell/renderer', file), 'utf8');
    const native = read('main.tsx'), web = read('main.web.tsx'), platform = read('app-shell/studio-platform.ts');
    assert.match(native, /createDesktopNimiAppSession/);
    assert.match(native, /installNimiShellRuntimeBridge/);
    assert.match(web, /createWebNimiAppSession/);
    assert.doesNotMatch(web, /installNimiShellRuntimeBridge|createNimiLocalAppStandardShellSurface/);
    assert.doesNotMatch(native + web + platform, /oauthLogin|tokenExchange|accessToken|refreshToken|sessionProof|launchNonce/);
    assert.doesNotMatch(platform, /createRuntimeAccountMediatedRealmTransport|createRealmFetchTransport/);
  });
});
