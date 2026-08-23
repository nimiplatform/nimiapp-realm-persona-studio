import type { NimiAIConfigSnapshot, NimiPortableAppAIConfig } from '@nimiplatform/sdk/ai';
import type { NimiLocalAppClient } from '@nimiplatform/sdk/app';
import { openDesktopIntent } from '@nimiplatform/kit/shell/renderer/bridge';
import { REALM_PERSONA_STUDIO_APP_ID } from '../../../app-identity.js';
import { getStudioLocalAppClient } from '@renderer/app-shell/studio-platform.js';

/**
 * Studio App AIConfig access on the Nimi App Access contract. The covered
 * self-owner manager is canonical and the screen edits it through the shared
 * Kit surface; Desktop handoff remains optional resource-management UI.
 */

export type StudioAIConfigClient = {
  readonly aiConfig: Pick<NimiLocalAppClient['aiConfig'], 'get' | 'overwrite' | 'listOptions'>;
};
export type StudioDesktopIntentOpener = typeof openDesktopIntent;

export function getStudioAIConfigManager(
  client: StudioAIConfigClient = getStudioLocalAppClient(),
): StudioAIConfigClient['aiConfig'] {
  return client.aiConfig;
}

// @nimi-authority: rule.realm-persona-studio.runtime-ai.r011
export async function loadStudioAIConfig(
  client: StudioAIConfigClient = getStudioLocalAppClient(),
): Promise<NimiAIConfigSnapshot> {
  const snapshot = await client.aiConfig.get();
  if (snapshot.config) requireStudioAIConfigOwner(snapshot.config);
  return snapshot;
}

export async function openStudioAIConfigurationInDesktop(
  openIntent: StudioDesktopIntentOpener = openDesktopIntent,
): Promise<void> {
  const result = await openIntent({
    intent: {
      kind: 'open-apps',
      appId: REALM_PERSONA_STUDIO_APP_ID,
      section: 'ai-models',
    },
  });
  if (result.status === 'rejected') {
    throw Object.assign(
      new Error(`Nimi Desktop rejected opening the Studio AI models surface (${result.reasonCode}).`),
      {
        reasonCode: result.reasonCode,
        actionHint: result.actionHint,
      },
    );
  }
}

export function requireStudioAIConfigOwner(config: NimiPortableAppAIConfig): NimiPortableAppAIConfig {
  const owner = config.owner?.owner;
  if (!owner || owner.oneofKind !== 'app' || !('app' in owner) || owner.app.appId !== REALM_PERSONA_STUDIO_APP_ID) {
    throw new Error(`Studio AIConfig owner must be the exact ${REALM_PERSONA_STUDIO_APP_ID} App.`);
  }
  return config;
}
