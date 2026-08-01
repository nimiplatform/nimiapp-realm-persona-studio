import { readFileSync } from 'node:fs';

const manifest = readFileSync(new URL('../nimi.app.yaml', import.meta.url), 'utf8');
const submission = readFileSync(new URL('../.nimi/admission/submission.yaml', import.meta.url), 'utf8');
const buildProfile = readFileSync(new URL('../.nimi/admission/build-profile.yaml', import.meta.url), 'utf8');

if (!manifest.includes('manifest_role: submitted-input')) {
  throw new Error('submitted manifest role marker missing in nimi.app.yaml');
}
if (!manifest.includes('app_id: nimi.realm-persona-studio')) {
  throw new Error('manifest app_id must be nimi.realm-persona-studio');
}
if (!submission.includes('submission_role: developer-submitted-input')) {
  throw new Error('developer submission role marker missing in submission.yaml');
}
if (!submission.includes('dev_command: pnpm dev')) {
  throw new Error('official dev command marker missing in submission.yaml');
}
if (!submission.includes('dev_electron_command: pnpm dev:electron')) {
  throw new Error('official Desktop-supervised Electron command marker missing in submission.yaml');
}
if (!submission.includes('admission_truth: platform-owned-after-review')) {
  throw new Error('admission_truth marker missing in submission.yaml');
}
if (!buildProfile.includes('profile_role: developer-workflow-input')) {
  throw new Error('developer build profile marker missing in build-profile.yaml');
}
if (!buildProfile.includes('lockfile_policy: author-install-generates-lockfile')) {
  throw new Error('lockfile_policy marker missing in build-profile.yaml');
}

console.log('[realm-persona-studio] validate pre-submission self-check passed');
