import type { CoreTransport, RealmOptions } from '@nimiplatform/sdk/realm';
import { withNimiRuntimeIdempotencyMetadata, type NimiRuntimeAccountCaller, type Runtime } from '@nimiplatform/sdk/runtime';
import { createNimiClientId, createNimiError, ReasonCode, type CoreUnaryRequest } from '@nimiplatform/sdk/types';

export function createStudioRealmBridgeOptions(
  realmBaseUrl: string,
  runtime: Runtime,
  caller: NimiRuntimeAccountCaller,
): RealmOptions {
  return {
    transport: createStudioRealmBridgeTransport(realmBaseUrl, runtime, caller),
  };
}

export function createStudioRealmBridgeTransport(
  realmBaseUrl: string,
  runtime: Runtime,
  caller: NimiRuntimeAccountCaller,
): CoreTransport {
  return {
    async unary<Response = unknown, Body = unknown>(request: CoreUnaryRequest<Body>): Promise<Response> {
      const requestJson = JSON.stringify(request.body ?? {});
      if (typeof requestJson !== 'string') {
        throw createNimiError({
          message: `Realm Persona Studio Realm request is not JSON-serializable: ${request.methodId}`,
          reasonCode: ReasonCode.SDK_REALM_OPERATION_UNKNOWN,
          actionHint: 'provide_json_realm_request',
          source: 'sdk',
        });
      }
      const result = await runtime.account.invokeRealmUnary({
        caller,
        methodId: request.methodId,
        realmBaseUrl,
        requestJson,
        timeoutMs: typeof request.timeoutMs === 'number' ? request.timeoutMs : 0,
      }, withNimiRuntimeIdempotencyMetadata({
        timeoutMs: request.timeoutMs,
        signal: request.signal,
      }, createNimiClientId(`realm-persona-studio-realm-${sanitizeMethodId(request.methodId)}`)));
      request.responseMetadataObserver?.({
        ...(result.httpStatus ? { status: String(result.httpStatus) } : {}),
      });
      if (!result.accepted) {
        throw createNimiError({
          message: result.errorMessage || `Realm operation ${request.methodId} failed through Runtime mediation.`,
          reasonCode: ReasonCode.SDK_REALM_HTTP_REQUEST_FAILED,
          actionHint: 'inspect_runtime_realm_mediation',
          source: 'runtime',
          details: {
            methodId: request.methodId,
            reasonCode: result.reasonCode,
            accountReasonCode: result.accountReasonCode,
            httpStatus: result.httpStatus,
          },
        });
      }
      return JSON.parse(result.responseJson || '{}') as Response;
    },
    serverStream() {
      throw createNimiError({
        message: 'Realm Persona Studio Realm bridge does not support server streams.',
        reasonCode: ReasonCode.SDK_REALM_FETCH_STREAM_UNSUPPORTED,
        actionHint: 'use_unary_realm_operation',
        source: 'sdk',
      });
    },
  };
}

function sanitizeMethodId(methodId: string): string {
  return methodId.replace(/[^a-zA-Z0-9._:-]/g, '_').slice(0, 80) || 'unknown';
}
