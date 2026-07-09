import {
  createNimiElectronInstalledAppRuntimeAccountTrustedMetadataProvider,
  type ElectronRuntimeBridgeTrustedMetadataProvider,
} from '@nimiplatform/kit/shell/electron/main';
import {
  REALM_PERSONA_STUDIO_RELEASE_DESCRIPTOR_REF,
  REALM_PERSONA_STUDIO_RUNTIME_APP_DEVICE_ID,
  REALM_PERSONA_STUDIO_RUNTIME_APP_ID,
  REALM_PERSONA_STUDIO_RUNTIME_APP_INSTANCE_ID,
} from '../src/shell/app-identity.js';

export type RealmPersonaStudioRendererLaunchBinding = {
  readonly appId: string;
  readonly appInstanceId: string;
  readonly deviceId: string;
  readonly launchHostId: string;
  readonly launchNonce: string;
  readonly releaseDescriptorRef: string;
  readonly realmBaseUrl: string;
};

const DESKTOP_INSTALLED_APP_LAUNCH_HOST_ID = 'desktop-electron-installed-app-host';

export function createRealmPersonaStudioElectronTrustedRuntimeMetadataProvider(input: {
  readonly runtimeEndpoint: string;
}): ElectronRuntimeBridgeTrustedMetadataProvider {
  const launchBinding = createRealmPersonaStudioRendererLaunchBinding();
  return createNimiElectronInstalledAppRuntimeAccountTrustedMetadataProvider({
    appId: REALM_PERSONA_STUDIO_RUNTIME_APP_ID,
    runtimeEndpoint: requireText(input.runtimeEndpoint, 'runtimeEndpoint'),
    installedApp: {
      appInstanceId: launchBinding.appInstanceId,
      deviceId: launchBinding.deviceId,
      launchHostId: launchBinding.launchHostId,
      launchNonce: launchBinding.launchNonce,
      releaseDescriptorRef: launchBinding.releaseDescriptorRef,
    },
    appSession: {
      appVersion: '0.1.0',
      capabilities: [],
      developerRegistration: false,
    },
    protectedAccess: {
      consentId: `${REALM_PERSONA_STUDIO_RUNTIME_APP_ID}:electron-installed-app-runtime-account`,
      authorizationVersion: 'electron-installed-app-runtime-account-v1',
      scopeCatalogVersion: 'desktop-installed-app-standard-shell-v1',
      scopes: [],
    },
  });
}

export function createRealmPersonaStudioRendererLaunchBinding(): RealmPersonaStudioRendererLaunchBinding {
  const launchNonce = requireText(
    process.env.NIMI_REALM_PERSONA_STUDIO_ELECTRON_LAUNCH_NONCE,
    'NIMI_REALM_PERSONA_STUDIO_ELECTRON_LAUNCH_NONCE',
  );
  return {
    appId: REALM_PERSONA_STUDIO_RUNTIME_APP_ID,
    appInstanceId: optionalText(process.env.NIMI_REALM_PERSONA_STUDIO_ELECTRON_APP_INSTANCE_ID)
      || REALM_PERSONA_STUDIO_RUNTIME_APP_INSTANCE_ID,
    deviceId: optionalText(process.env.NIMI_REALM_PERSONA_STUDIO_ELECTRON_DEVICE_ID)
      || REALM_PERSONA_STUDIO_RUNTIME_APP_DEVICE_ID,
    launchHostId: DESKTOP_INSTALLED_APP_LAUNCH_HOST_ID,
    launchNonce,
    releaseDescriptorRef: optionalText(process.env.NIMI_REALM_PERSONA_STUDIO_ELECTRON_RELEASE_DESCRIPTOR_REF)
      || REALM_PERSONA_STUDIO_RELEASE_DESCRIPTOR_REF,
    realmBaseUrl: resolveRealmPersonaStudioRealmBaseUrl(),
  };
}

function resolveRealmPersonaStudioRealmBaseUrl(): string {
  const realmBaseUrl = optionalText(process.env.NIMI_REALM_PERSONA_STUDIO_ELECTRON_REALM_BASE_URL)
    || optionalText(process.env.NIMI_REALM_BASE_URL)
    || optionalText(process.env.NIMI_REALM_URL);
  if (!realmBaseUrl) {
    throw new Error('Realm Persona Studio Electron launch binding requires host-projected Realm base URL env.');
  }
  return new URL(realmBaseUrl).toString();
}

function requireText(value: unknown, field: string): string {
  const normalized = optionalText(value);
  if (!normalized) {
    throw new Error(`Realm Persona Studio Electron Runtime auth requires ${field}`);
  }
  return normalized;
}

function optionalText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
