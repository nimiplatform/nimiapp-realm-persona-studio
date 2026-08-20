import type { NimiPortableAppAIConfig } from '@nimiplatform/sdk/ai';
import type { NimiLocalAppClient } from '@nimiplatform/sdk/app';
import { openDesktopIntent } from '@nimiplatform/kit/shell/renderer/bridge';
import { REALM_PERSONA_STUDIO_APP_ID } from '../../../app-identity.js';
import { getStudioLocalAppClient } from '@renderer/app-shell/studio-platform.js';

/**
 * Studio App AIConfig access on the Nimi App Access contract. The protected
 * App surface is projection-only; Nimi Desktop owns configuration changes and
 * independently resolves the canonical owner. Studio's appId is only a
 * navigation target. The admitted open-apps ai-models section selects the
 * Nimi-owned App AIConfig editor without granting mutation authority to Studio.
 * Missing App AIConfig is one typed unconfigured projection, never a
 * pseudo-configured state or an invitation to shadow it.
 */

export type StudioAIConfigClient = Pick<NimiLocalAppClient, 'aiConfig'>;
export type StudioDesktopIntentOpener = typeof openDesktopIntent;

export async function loadStudioAIConfig(
  client: StudioAIConfigClient = getStudioLocalAppClient(),
): Promise<NimiPortableAppAIConfig | null> {
  try {
    return requireStudioAIConfigOwner(await client.aiConfig.get());
  } catch (error) {
    if (isStudioAIConfigNotFound(error)) {
      return null;
    }
    throw error;
  }
}

// @nimi-authority: rule.realm-persona-studio.runtime-ai.r011
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

function isStudioAIConfigNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const record = error as Record<string, unknown>;
  const reason = typeof record.reasonCode === 'string'
    ? record.reasonCode
    : typeof record.code === 'string'
      ? record.code
      : '';
  return reason.trim().toUpperCase().replaceAll('-', '_') === 'AI_CONFIG_NOT_FOUND';
}
