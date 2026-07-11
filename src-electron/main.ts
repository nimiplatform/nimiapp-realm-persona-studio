import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import { NIMI_INSTALLED_NIMI_APP_STANDARD_SHELL_CAPABILITY_SET_ID } from '@nimiplatform/kit/shell/capabilities';
import {
  createNimiElectronInstalledHost,
  createNimiElectronStandardApplicationMenuTemplate,
  isAllowedElectronRendererUrl,
  registerNimiElectronRuntimeBridge,
} from '@nimiplatform/kit/shell/electron/main';
import {
  REALM_PERSONA_STUDIO_APP_ID,
  REALM_PERSONA_STUDIO_APP_NAME,
} from '../src/shell/app-identity.js';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const appRoot = resolveAppRoot(currentDir);
const preloadPath = path.join(currentDir, 'preload.cjs');
const rendererDistIndex = path.join(appRoot, 'dist', 'index.html');
const rendererDistUrl = pathToFileURL(rendererDistIndex).toString();
const rendererUrl = normalizeText(process.env.NIMI_REALM_PERSONA_STUDIO_ELECTRON_RENDERER_URL);
const runtimeEndpoint = '127.0.0.1:46371';

app.setName(REALM_PERSONA_STUDIO_APP_NAME);
installRealmPersonaStudioStandardApplicationMenu();
configureRealmPersonaStudioElectronChromiumRuntime();

void app.whenReady().then(bootstrapElectron).catch(handleElectronStartupFailure);

async function bootstrapElectron(): Promise<void> {
  registerNimiElectronRuntimeBridge({
    appId: REALM_PERSONA_STUDIO_APP_ID,
    runtimeEndpoint,
    allowedOrigins: allowedRendererOrigins(),
    allowedRendererUrls: allowedRendererUrls(),
    ipcMain,
    standardShellHost: {
      capabilitySetRef: NIMI_INSTALLED_NIMI_APP_STANDARD_SHELL_CAPABILITY_SET_ID,
      installedHost: createNimiElectronInstalledHost(),
    },
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
  if (rendererUrl) {
    await window.loadURL(rendererUrl);
    return;
  }
  await window.loadURL(rendererDistUrl);
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

function allowedRendererOrigins(): string[] {
  const origins = new Set<string>();
  for (const url of allowedRendererUrls()) {
    origins.add(originForRendererUrl(url));
  }
  for (const origin of normalizeText(process.env.NIMI_REALM_PERSONA_STUDIO_ELECTRON_ALLOWED_ORIGINS).split(',')) {
    const normalized = normalizeText(origin);
    if (normalized) {
      origins.add(normalized);
    }
  }
  return [...origins];
}

function originForRendererUrl(url: string): string {
  const parsed = new URL(url);
  return parsed.protocol === 'file:' ? 'file://' : parsed.origin;
}

function allowedRendererUrls(): string[] {
  const urls = new Set<string>([rendererUrl || rendererDistUrl]);
  for (const url of normalizeText(process.env.NIMI_REALM_PERSONA_STUDIO_ELECTRON_ALLOWED_RENDERER_URLS).split(',')) {
    const normalized = normalizeText(url);
    if (normalized) {
      urls.add(normalized);
    }
  }
  return [...urls];
}

function isRealmPersonaStudioRendererUrl(url: string): boolean {
  return isAllowedElectronRendererUrl(url, allowedRendererUrls());
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
