import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { app, BrowserWindow, ipcMain, Menu, protocol, session, webContents } from 'electron';
import { configureNimiElectronAppHostProfile } from '@nimiplatform/kit/shell/electron/host-profile';

// @nimi-authority: rule.realm-persona-studio.runtime-ai.r009
try {
  configureNimiElectronAppHostProfile(app);
} catch (error) {
  process.stderr.write(`[nimi-app-host-profile] ${error instanceof Error ? error.message : String(error)}\n`);
  app.exit(78);
  throw error;
}

const {
  createNimiElectronStandardApplicationMenuTemplate,
  isAllowedElectronRendererUrl,
  registerNimiElectronAppAssetProtocolScheme,
  registerNimiElectronAppBridge,
} = await import('@nimiplatform/kit/shell/electron/main');
import { installStudioUnloadConfirmation } from './studio-unload-confirmation.js';

const REALM_PERSONA_STUDIO_APP_ID = 'nimi.realm-persona-studio';
const REALM_PERSONA_STUDIO_APP_NAME = 'Realm Persona Studio';

declare const __NIMI_ELECTRON_PRODUCTION__: boolean;
const IS_PRODUCTION_BUNDLE = typeof __NIMI_ELECTRON_PRODUCTION__ !== 'undefined'
  && __NIMI_ELECTRON_PRODUCTION__;

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const appRoot = resolveAppRoot(currentDir);
const preloadPath = path.join(currentDir, 'preload.cjs');
const rendererDistIndex = path.join(appRoot, 'dist', 'index.html');
const rendererDistUrl = pathToFileURL(rendererDistIndex).toString();
const developmentRendererUrl = readDevelopmentRendererUrl();
const rendererUrl = developmentRendererUrl || rendererDistUrl;
let resettingRenderer = false;
let quitting = false;

app.setName(REALM_PERSONA_STUDIO_APP_NAME);
installRealmPersonaStudioStandardApplicationMenu();
configureRealmPersonaStudioElectronChromiumRuntime();
registerNimiElectronAppAssetProtocolScheme(protocol);

void app.whenReady().then(bootstrapElectron).catch(handleElectronStartupFailure);

async function bootstrapElectron(): Promise<void> {
  if (developmentRendererUrl) {
    // Dev-server responses are transient. A poisoned HTTP cache entry can
    // wedge the shell on a stale raw byte stream, so never reuse cached
    // development renderer content.
    await session.defaultSession.clearCache();
  }
  registerNimiElectronAppBridge({
    appId: REALM_PERSONA_STUDIO_APP_ID,
    allowedRendererUrls: [rendererUrl],
    assetMediaPlatform: { protocol, webRequest: session.defaultSession.webRequest, webContents },
    ipcMain,
    onSessionInvalidated: resetAccountScopedRenderer,
  });

  await createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
}

function handleElectronStartupFailure(error: unknown): void {
  process.stderr.write(`${error instanceof Error ? error.message : String(error || 'Realm Persona Studio Electron startup failed')}\n`);
  app.quit();
}

function resolveAppRoot(electronDir: string): string {
  if (path.basename(electronDir) === 'src-electron' && path.basename(path.dirname(electronDir)) === 'dist-electron') {
    return path.resolve(electronDir, '..', '..');
  }
  return path.resolve(electronDir, '..');
}

function configureRealmPersonaStudioElectronChromiumRuntime(): void {
  app.commandLine.appendSwitch('disable-background-networking');
}

function installRealmPersonaStudioStandardApplicationMenu(): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate(
    createNimiElectronStandardApplicationMenuTemplate({ appName: REALM_PERSONA_STUDIO_APP_NAME }),
  ));
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !resettingRenderer && BrowserWindow.getAllWindows().length === 0) {
    app.quit();
  }
});
app.on('before-quit', () => { quitting = true; });

function resetAccountScopedRenderer(): void {
  const windows = BrowserWindow.getAllWindows();
  if (quitting || windows.length === 0) return;
  resettingRenderer = true;
  try {
    for (const window of windows) window.destroy();
    void createMainWindow().catch((error: unknown) => {
      process.stderr.write(`[nimi-app-session-reset] ${error instanceof Error ? error.message : String(error)}\n`);
    });
  } finally { resettingRenderer = false; }
}

async function createMainWindow(): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1040,
    minHeight: 680,
    title: REALM_PERSONA_STUDIO_APP_NAME,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  hardenRealmPersonaStudioWindowChrome(window);
  secureRealmPersonaStudioWindow(window);
  installStudioUnloadConfirmation(window, app.getLocale());
  await loadRenderer(window);
  return window;
}

async function loadRenderer(window: BrowserWindow): Promise<void> {
  try { await window.loadURL(rendererUrl); }
  catch (error) { if (!window.isDestroyed()) throw error; }
}

function hardenRealmPersonaStudioWindowChrome(window: BrowserWindow): void {
  window.setAutoHideMenuBar(true);
  window.setMenuBarVisibility(false);
}

function secureRealmPersonaStudioWindow(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!isRealmPersonaStudioRendererUrl(url)) {
      event.preventDefault();
    }
  });
}

function allowedRendererUrls(): string[] {
  return [rendererUrl];
}

function isRealmPersonaStudioRendererUrl(url: string): boolean {
  return isAllowedElectronRendererUrl(url, allowedRendererUrls());
}

function readDevelopmentRendererUrl(): string {
  const prefix = '--nimi-dev-renderer-url=';
  const values = process.argv.filter((value) => value.startsWith(prefix));
  if (IS_PRODUCTION_BUNDLE && values.length > 0) {
    throw new Error("Production App does not accept development renderer arguments.");
  }
  if (values.length === 0) return '';
  if (values.length !== 1) throw new Error('Nimi development renderer URL must be singular.');
  const selected = values[0];
  if (!selected) throw new Error('Nimi development renderer URL is missing.');
  const parsed = new URL(selected.slice(prefix.length));
  if (
    parsed.protocol !== 'http:'
    || !['127.0.0.1', 'localhost', '[::1]', '::1'].includes(parsed.hostname.toLowerCase())
    || !parsed.port
    || parsed.username
    || parsed.password
    || (parsed.pathname !== '/' && parsed.pathname !== '')
    || parsed.search
    || parsed.hash
  ) {
    throw new Error('Nimi development renderer URL must be exact loopback.');
  }
  return parsed.origin;
}
