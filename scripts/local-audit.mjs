import { readFileSync } from 'node:fs';

const submission = readFileSync(new URL('../.nimi/admission/submission.yaml', import.meta.url), 'utf8');
const buildProfile = readFileSync(new URL('../.nimi/admission/build-profile.yaml', import.meta.url), 'utf8');
const manifest = readFileSync(new URL('../nimi.app.yaml', import.meta.url), 'utf8');
const admission = readFileSync(new URL('../ADMISSION.md', import.meta.url), 'utf8');
const security = readFileSync(new URL('../SECURITY.md', import.meta.url), 'utf8');

// Pre-submission inputs must never claim platform-owned truth.
if (!submission.includes('admission_truth: platform-owned-after-review')) {
  throw new Error('submission.yaml must defer admission truth to platform-after-review');
}
if (!submission.includes('submission_role: developer-submitted-input')) {
  throw new Error('submission.yaml must mark itself as developer-submitted-input');
}
if (!buildProfile.includes('profile_role: developer-workflow-input')) {
  throw new Error('build-profile.yaml must mark itself as developer-workflow-input');
}
if (!manifest.includes('manifest_role: submitted-input')) {
  throw new Error('nimi.app.yaml must mark itself as submitted-input');
}

const forbiddenClaims = [
  'install_grant',
  'permission_grant',
  'public_admission_truth',
  'release_descriptor',
];
for (const file of [submission, buildProfile, manifest]) {
  for (const claim of forbiddenClaims) {
    if (new RegExp(`${claim}\\s*:\\s*(true|granted|approved)`, 'i').test(file)) {
      throw new Error(`pre-submission input must not assert ${claim}`);
    }
  }
}

// ADMISSION.md and SECURITY.md must mark reviewer boundary + credential boundary.
if (!admission.includes('Reviewer Boundary')) {
  throw new Error('ADMISSION.md must include a Reviewer Boundary section');
}
if (!admission.includes('not an approval')) {
  throw new Error('ADMISSION.md must explicitly disclaim approval semantics');
}
if (!security.includes('refresh-token custody lives in Runtime')) {
  throw new Error('SECURITY.md must declare refresh-token custody boundary');
}

console.log('[realm-persona-studio] local-audit pre-submission self-check passed');
