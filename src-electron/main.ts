import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import {
  createNimiElectronStandardApplicationMenuTemplate,
  isAllowedElectronRendererUrl,
  registerNimiElectronAppBridge,
} from '@nimiplatform/kit/shell/electron/main';

const REALM_PERSONA_STUDIO_APP_ID = 'nimi.realm-persona-studio';
const REALM_PERSONA_STUDIO_APP_NAME = 'Realm Persona Studio';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const appRoot = resolveAppRoot(currentDir);
const preloadPath = path.join(currentDir, 'preload.cjs');
const rendererDistIndex = path.join(appRoot, 'dist', 'index.html');
const rendererDistUrl = pathToFileURL(rendererDistIndex).toString();
const rendererUrl = readDevelopmentRendererUrl() || rendererDistUrl;

app.setName(REALM_PERSONA_STUDIO_APP_NAME);
installRealmPersonaStudioStandardApplicationMenu();
configureRealmPersonaStudioElectronChromiumRuntime();

void app.whenReady().then(bootstrapElectron).catch(handleElectronStartupFailure);

async function bootstrapElectron(): Promise<void> {
  registerNimiElectronAppBridge({
    appId: REALM_PERSONA_STUDIO_APP_ID,
    allowedRendererUrls: [rendererUrl],
    ipcMain,
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
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

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
  await loadRenderer(window);
  return window;
}

async function loadRenderer(window: BrowserWindow): Promise<void> {
  await window.loadURL(rendererUrl);
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
