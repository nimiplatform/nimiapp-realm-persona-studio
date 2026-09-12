import type { RealmOwnerPersonaSettings } from '../src/shell/renderer/features/portfolio/portfolio-settings-client.js';
import type { OwnerPortfolioPersonaDetail } from '../src/shell/renderer/features/portfolio/portfolio-data.js';
import { persona as example } from '../src/shell/renderer/features/portfolio/portfolio-client.test-helpers.js';
// This Vite alias exists only in Storybook. Mutations still use the real client
// and fail without a protected host; these reads are explicitly labelled fixtures.
export * from '../src/shell/renderer/features/portfolio/portfolio-settings-client.js';
let unavailable = false;
export function configureSettingsFixture(fail: boolean) { unavailable = fail; }
export async function getPortfolioPersonaSettings(detail: OwnerPortfolioPersonaDetail): Promise<RealmOwnerPersonaSettings> {
  if (unavailable) throw Object.assign(new Error('Storybook unavailable read fixture'), { reasonCode: 'realm-unavailable' });
  const displayName = detail.displayName.value || '';
  const description = detail.bio.value || '';
  const greeting = detail.greeting.value || '';
  const handle = detail.handle.value || '';
  const persona = {
    ...example, id: detail.id, contentHash: detail.contentHash, worldId: detail.homeWorldId,
    profile: {
      ...example.profile,
      identity: { ...example.profile.identity, name: displayName, handle, summary: description },
      presentation: { ...example.profile.presentation, displayName, profileLine: description },
      narrative: { ...example.profile.narrative, summary: description },
      interactionProfile: { ...example.profile.interactionProfile, greeting },
    },
    lorebookDeclaration: {
      identity: description || '示例角色', behavior: ['先认真倾听，再提出具体建议。'],
      speaking: ['语气温和，偶尔带一点俏皮。'], immutableBoundaries: ['尊重对方的选择，不编造共同经历。'], relationshipPostures: [],
    },
  };
  return {
    id: persona.id, contentHash: persona.contentHash, homeWorldId: persona.worldId,
    visibility: persona.visibility, origin: persona.origin, profile: persona.profile, persona,
    lorebookDeclaration: persona.lorebookDeclaration, displayName, description, greeting, handle,
  };
}
