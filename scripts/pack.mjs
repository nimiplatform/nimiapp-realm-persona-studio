import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

if (!existsSync(join('dist', 'index.html'))) {
  throw new Error('renderer build output missing: run pnpm run build:renderer before packing');
}

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const tauriConfig = JSON.parse(readFileSync(join('src-tauri', 'tauri.conf.json'), 'utf8'));
const manifest = readFileSync('nimi.app.yaml', 'utf8');
const submission = readFileSync(join('.nimi', 'admission', 'submission.yaml'), 'utf8');
const buildProfile = readFileSync(join('.nimi', 'admission', 'build-profile.yaml'), 'utf8');

if (!manifest.includes('manifest_role: submitted-input')) {
  throw new Error('submitted manifest role marker missing in nimi.app.yaml');
}
if (!submission.includes('submission_role: developer-submitted-input')) {
  throw new Error('developer submission role marker missing in submission.yaml');
}
if (!buildProfile.includes('profile_role: developer-workflow-input')) {
  throw new Error('developer build profile marker missing in build-profile.yaml');
}
if (!manifest.includes('app_id: nimi.realm-persona-studio')) {
  throw new Error('manifest app_id must be nimi.realm-persona-studio');
}
if (tauriConfig.identifier !== 'nimi.realm-persona-studio') {
  throw new Error(`tauri identifier mismatch: expected nimi.realm-persona-studio, got ${tauriConfig.identifier}`);
}

mkdirSync('dist', { recursive: true });

const packet = {
  packetRole: 'developer-submitted-input',
  packageName: packageJson.name,
  appVersion: tauriConfig.version,
  appId: 'nimi.realm-persona-studio',
  displayName: tauriConfig.productName,
  tauriIdentifier: tauriConfig.identifier,
  rendererEntry: 'dist/index.html',
  manifestPath: 'nimi.app.yaml',
  admissionRequestPath: '.nimi/admission/submission.yaml',
  buildProfilePath: '.nimi/admission/build-profile.yaml',
  specAuthorityRoot: '.nimi/spec/project/kernel',
  specRuleCatalog: '.nimi/spec/project/kernel/tables/rule-catalog.yaml',
  generatedAt: new Date().toISOString(),
  admissionTruth: 'platform-owned-after-review',
};

const outPath = join('dist', 'nimi-app-submission.json');
writeFileSync(outPath, `${JSON.stringify(packet, null, 2)}\n`);
console.log(`[realm-persona-studio] pack wrote ${outPath}`);
