import type { NimiClient } from '@nimiplatform/sdk';

let studioNimiClient: NimiClient | null = null;

export function setStudioNimiClient(client: NimiClient | null): void {
  studioNimiClient = client;
}

export function hasStudioNimiClient(): boolean {
  return studioNimiClient !== null;
}

export function getStudioNimiClient(): NimiClient {
  if (!studioNimiClient) {
    throw new Error('Realm Persona Studio Nimi client is not ready.');
  }
  return studioNimiClient;
}
