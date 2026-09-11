import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AmbientBackground,
  LoadingSkeleton,
  NimiThemeProvider,
  Surface,
} from '@nimiplatform/kit/ui';
import { installNimiShellRuntimeBridge } from '@nimiplatform/kit/shell/renderer/bridge';
import {
  DEFAULT_DEV_RENDERER_ENTRY_IMPORT_RETRY_DELAYS_MS,
  createRendererEntryModuleLoader,
} from '@nimiplatform/kit/shell/renderer/bootstrap';
import { installStudioGlobalErrorLogging } from './infra/telemetry/renderer-log.js';
import { ensureStudioI18nInitialized, translateStudioCopy } from './i18n/studio-i18n.js';
import { readStoredThemeScheme } from './app-shell/theme-scheme.js';
import './styles.css';

ensureStudioI18nInitialized();
installStudioGlobalErrorLogging();
installNimiShellRuntimeBridge();

const entryModuleLoader = createRendererEntryModuleLoader({
  retryDelaysMs: import.meta.env.DEV ? DEFAULT_DEV_RENDERER_ENTRY_IMPORT_RETRY_DELAYS_MS : [],
});

const App = lazy(async () => {
  const mod = await entryModuleLoader.load('entry:realm-persona-studio-app', () => import('./App.js'));
  return { default: mod.App };
});

function EntryFallback() {
  return (
    <AmbientBackground variant="mesh" className="ras-entry-fallback">
      <Surface tone="panel" padding="lg" className="ras-entry-fallback__panel">
        <div className="ras-entry-fallback__title">{translateStudioCopy('app.name')}</div>
        <LoadingSkeleton lines={2} aria-label={translateStudioCopy('shell.entry.loading')} />
      </Surface>
    </AmbientBackground>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('REALM_PERSONA_STUDIO_ROOT_MISSING');
}

async function bootstrapStudioRenderer(root: HTMLElement) {
  // Seed the provider from the stored appearance choice before first paint so
  // dark-scheme owners never see a light flash. Missing or unreadable
  // preference fails closed to the light default.
  const storedScheme = await readStoredThemeScheme();
  createRoot(root).render(
    <StrictMode>
      <NimiThemeProvider accentPack="nimi-accent" defaultScheme={storedScheme ?? 'light'} defaultDensity="compact">
        <Suspense fallback={<EntryFallback />}>
          <App />
        </Suspense>
      </NimiThemeProvider>
    </StrictMode>,
  );
}

void bootstrapStudioRenderer(rootElement);
