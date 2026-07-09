import { createRuntimeAccountMediatedRealmTransport } from '@nimiplatform/sdk';
import type { RealmOptions } from '@nimiplatform/sdk/realm';
import type { NimiRuntimeAccountCaller, Runtime } from '@nimiplatform/sdk/runtime';

export function createStudioRealmBridgeOptions(
  realmBaseUrl: string,
  runtime: Runtime,
  caller: NimiRuntimeAccountCaller,
): RealmOptions {
  return {
    transport: createRuntimeAccountMediatedRealmTransport({
      realmBaseUrl,
      runtime,
      accountCaller: caller,
    }),
  };
}
