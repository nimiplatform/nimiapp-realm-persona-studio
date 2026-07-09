import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import { NIMI_STANDARD_SHELL_COMMANDS } from '@nimiplatform/kit/shell/capabilities';
import {
  createNimiElectronFileAIConfigStore,
  createNimiElectronStandardApplicationMenuTemplate,
  isAllowedElectronRendererUrl,
  registerNimiElectronRuntimeBridge,
  type NimiElectronHostCommandPolicy,
} from '@nimiplatform/kit/shell/electron/main';
import {
  REALM_PERSONA_STUDIO_APP_ID,
  REALM_PERSONA_STUDIO_APP_NAME,
} from '../src/shell/app-identity.js';
import {
  createRealmPersonaStudioElectronTrustedRuntimeMetadataProvider,
  createRealmPersonaStudioRendererLaunchBinding,
} from './runtime-auth.js';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const appRoot = resolveAppRoot(currentDir);
const preloadPath = path.join(currentDir, 'preload.cjs');
const rendererDistIndex = path.join(appRoot, 'dist', 'index.html');
const rendererDistUrl = pathToFileURL(rendererDistIndex).toString();
const rendererUrl = normalizeText(process.env.NIMI_REALM_PERSONA_STUDIO_ELECTRON_RENDERER_URL);
const runtimeEndpoint = normalizeText(process.env.NIMI_RUNTIME_GRPC_ADDR)
  || normalizeText(process.env.NIMI_REALM_PERSONA_STUDIO_ELECTRON_RUNTIME_ENDPOINT)
  || '127.0.0.1:46371';
let mainWindow: BrowserWindow | undefined;

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
    trustedRuntimeMetadataProvider: createRealmPersonaStudioElectronTrustedRuntimeMetadataProvider({
      runtimeEndpoint,
    }),
    commandPolicy: realmPersonaStudioElectronCommandPolicy,
    standardShellHost: {
      capabilitySetRef: 'installed-nimi-app-standard-shell-v1',
      standardDataRootBinding: {
        source: 'runtime-launch-projection',
        durableDataRoot: path.join(app.getPath('userData'), 'installed-app-data'),
        cacheRoot: path.join(app.getPath('userData'), 'installed-app-cache'),
        tempRoot: path.join(app.getPath('temp'), 'realm-persona-studio'),
        projectionRef: 'realm-persona-studio-electron-dev-shell',
      },
      localAssetRoots: [appRoot],
      aiConfigStore: createNimiElectronFileAIConfigStore({
        dataRoot: path.join(app.getPath('userData'), 'installed-app-data'),
        storeLabel: 'Realm Persona Studio Electron AI Config',
      }),
      focusMainWindow,
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
  const launchBinding = createRealmPersonaStudioRendererLaunchBinding();
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
      ...(launchBinding
        ? {
            additionalArguments: [
              `--nimi-installed-app-launch-binding=${Buffer.from(JSON.stringify(launchBinding), 'utf8').toString('base64url')}`,
            ],
          }
        : {}),
    },
  });
  mainWindow = window;
  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = undefined;
    }
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

const allowedStandardCommands: ReadonlySet<string> = new Set([
  NIMI_STANDARD_SHELL_COMMANDS['runtime.unary'],
  NIMI_STANDARD_SHELL_COMMANDS['runtime.streamOpen'],
  NIMI_STANDARD_SHELL_COMMANDS['runtime.streamClose'],
  NIMI_STANDARD_SHELL_COMMANDS['data.pathResolve'],
  NIMI_STANDARD_SHELL_COMMANDS['storage.readJson'],
  NIMI_STANDARD_SHELL_COMMANDS['storage.writeJson'],
  NIMI_STANDARD_SHELL_COMMANDS['storage.removeJson'],
  NIMI_STANDARD_SHELL_COMMANDS['config.get'],
  NIMI_STANDARD_SHELL_COMMANDS['config.set'],
  NIMI_STANDARD_SHELL_COMMANDS['ai-config.get'],
  NIMI_STANDARD_SHELL_COMMANDS['ai-config.set'],
  NIMI_STANDARD_SHELL_COMMANDS['local-assets.resolveUrl'],
  NIMI_STANDARD_SHELL_COMMANDS['desktop-open.openIntent'],
  NIMI_STANDARD_SHELL_COMMANDS['shell-ui.confirmDialog'],
  NIMI_STANDARD_SHELL_COMMANDS['shell-ui.startWindowDrag'],
  NIMI_STANDARD_SHELL_COMMANDS['shell-ui.focusMainWindow'],
]);

const realmPersonaStudioElectronCommandPolicy: NimiElectronHostCommandPolicy = (input) => {
  if (input.commandKind === 'standard' && allowedStandardCommands.has(input.command)) {
    return { allow: true };
  }
  return {
    allow: false,
    code: 'capability-unavailable',
    reasonCode: 'realm-persona-studio-electron-command-not-admitted',
    actionHint: 'use_admitted_realm_persona_studio_shell_command',
    details: { command: input.command, commandKind: input.commandKind },
  };
};

async function focusMainWindow(): Promise<void> {
  const window = mainWindow && !mainWindow.isDestroyed()
    ? mainWindow
    : BrowserWindow.getAllWindows().find((candidate) => !candidate.isDestroyed());
  if (!window) {
    throw new Error('Realm Persona Studio Electron main window unavailable');
  }
  if (window.isMinimized()) {
    window.restore();
  }
  window.show();
  window.focus();
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
