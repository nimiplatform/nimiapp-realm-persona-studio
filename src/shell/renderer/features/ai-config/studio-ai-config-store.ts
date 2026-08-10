import type {
  NimiPortableAppAIConfig,
  NimiPortableAppAIConfigIntent,
} from '@nimiplatform/sdk/ai';
import type { NimiLocalAppClient } from '@nimiplatform/sdk/app';
import { REALM_PERSONA_STUDIO_APP_ID } from '../../../app-identity.js';
import { getStudioLocalAppClient } from '@renderer/app-shell/studio-platform.js';

/**
 * Studio App AIConfig access on the Nimi App Access contract. Studio submits
 * capability intent only; the host and Runtime fix the exact App owner and own
 * implementation selection. Missing App AIConfig is one typed unconfigured
 * projection, never a pseudo-configured state.
 */

export const STUDIO_TEXT_GENERATE_CAPABILITY_CONTRACT = 'text.generate' as const;

export type StudioAIConfigClient = Pick<NimiLocalAppClient, 'aiConfig'>;

export async function loadStudioAIConfig(
  client: StudioAIConfigClient = getStudioLocalAppClient(),
): Promise<NimiPortableAppAIConfig | null> {
  try {
    return await client.aiConfig.get();
  } catch (error) {
    if (isStudioAIConfigNotFound(error)) {
      return null;
    }
    throw error;
  }
}

export function createStudioLocalCapabilityIntent(
  capabilityContract: string = STUDIO_TEXT_GENERATE_CAPABILITY_CONTRACT,
): NimiPortableAppAIConfigIntent {
  return {
    capabilityContract,
    requiredFeatures: [],
    route: { oneofKind: 'local', local: {} },
  };
}

export async function overwriteStudioCapabilityIntent(
  intent: NimiPortableAppAIConfigIntent,
  client: StudioAIConfigClient = getStudioLocalAppClient(),
): Promise<NimiPortableAppAIConfig> {
  const current = await loadStudioAIConfig(client);
  const retained = (current?.capabilities ?? []).filter(
    (existing) => existing.capabilityContract !== intent.capabilityContract,
  );
  return requireStudioAIConfigOwner(await client.aiConfig.overwrite([...retained, intent]));
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
