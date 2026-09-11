import type { NimiThemeScheme } from '@nimiplatform/kit/ui';
import { getStudioProtectedJsonStorage } from './studio-storage.js';

export const STUDIO_THEME_SCHEME_STORAGE_PATH = 'shell/theme-scheme.json';

/**
 * Owner's appearance preference for the Studio renderer. Read once at
 * bootstrap to seed NimiThemeProvider; runtime changes flow through kit
 * `useNimiTheme().setScheme` and persist back through this module. Any read
 * failure (missing Desktop bridge, absent key, malformed value) resolves to
 * null so the provider falls back to its light default.
 */
export async function readStoredThemeScheme(): Promise<NimiThemeScheme | null> {
  try {
    const document = await getStudioProtectedJsonStorage().readJson(STUDIO_THEME_SCHEME_STORAGE_PATH);
    if (!document.value || typeof document.value !== 'object' || Array.isArray(document.value)) return null;
    const scheme = (document.value as Record<string, unknown>).scheme;
    return scheme === 'dark' || scheme === 'light' ? scheme : null;
  } catch {
    return null;
  }
}

export async function persistThemeScheme(scheme: NimiThemeScheme): Promise<boolean> {
  try {
    await getStudioProtectedJsonStorage().writeJson(STUDIO_THEME_SCHEME_STORAGE_PATH, { scheme });
    return true;
  } catch {
    return false;
  }
}
