import { createRoot } from 'react-dom/client';
import { NimiThemeProvider } from '@nimiplatform/kit/ui';
import { NimiAppSessionProvider, type NimiAppSession } from '@nimiplatform/kit/auth/app';
import { lazy, Suspense } from 'react';
import { LoadingSkeleton } from '@nimiplatform/kit/ui';
import { DEFAULT_DEV_RENDERER_ENTRY_IMPORT_RETRY_DELAYS_MS, createRendererEntryModuleLoader } from '@nimiplatform/kit/shell/renderer/bootstrap';
import { installStudioGlobalErrorLogging } from './infra/telemetry/renderer-log.js';
import { ensureStudioI18nInitialized, translateStudioCopy } from './i18n/studio-i18n.js';
import './styles.css';
const loader = createRendererEntryModuleLoader({ retryDelaysMs: import.meta.env.DEV ? DEFAULT_DEV_RENDERER_ENTRY_IMPORT_RETRY_DELAYS_MS : [] });
const App = lazy(async () => { const module = await loader.load('entry:realm-persona-studio-app', () => import('./App.js')); return { default: module.App }; });
export function mountStudio(session: NimiAppSession) {
  ensureStudioI18nInitialized(); installStudioGlobalErrorLogging();
  const element = document.getElementById('root'); if (!element) throw new Error('REALM_PERSONA_STUDIO_ROOT_MISSING');
  const root = createRoot(element);
  root.render(<NimiThemeProvider accentPack="nimi-accent" defaultScheme="light" defaultDensity="compact"><NimiAppSessionProvider session={session}><Suspense fallback={<LoadingSkeleton lines={2} aria-label={translateStudioCopy('shell.entry.loading')} />}><App /></Suspense></NimiAppSessionProvider></NimiThemeProvider>);
  void session.start();
  return () => { session.dispose(); root.unmount(); };
}
