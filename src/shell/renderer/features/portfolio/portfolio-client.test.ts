import type { RealmModel } from '@nimiplatform/sdk/realm/generated';
import { describe, expect, it } from 'vitest';
import {
  buildRealmCreatePersonaInput,
  checkCreateRealmPersonaHandleAvailability,
  createReviewedRealmPersona,
  createReviewedRealmPersonaWithProfileSettings,
  getOwnerPortfolioPersonaDetail,
  listOwnerPortfolioPersonas,
  normalizeRealmPersonaCreateResult,
} from './portfolio-client.js';
import { createPayload, persona } from './portfolio-client.test-helpers.js';

describe('owner portfolio core client', () => {
  it('fails closed for every Persona operation missing from Nimi App Access', async () => {
    const operations = [
      listOwnerPortfolioPersonas(),
      getOwnerPortfolioPersonaDetail('persona-1'),
      checkCreateRealmPersonaHandleAvailability('mira'),
      createReviewedRealmPersona(createPayload),
      createReviewedRealmPersonaWithProfileSettings(createPayload),
    ];

    for (const operation of operations) {
      await expect(operation).rejects.toMatchObject({
        reasonCode: 'capability-unavailable',
        actionHint: 'retry_when_platform_surface_available',
      });
    }
  });

  it('builds the reviewed create DTO without caller-owned transport fields', () => {
    const input = buildRealmCreatePersonaInput(createPayload);

    expect(input).toEqual(createPayload.body);
    expect(input).not.toHaveProperty('accessToken');
    expect(input).not.toHaveProperty('ownerAccountId');
  });

  it('normalizes canonical create source fields independently from transport', () => {
    const result = normalizeRealmPersonaCreateResult(persona);

    expect(result).toMatchObject({
      ok: true,
      canonical: {
        id: 'persona-1',
        contentHash: 'hash-persona-1',
        homeWorldId: 'world-oasis',
      },
    });
  });

  it('rejects create responses without a canonical id or source fields', () => {
    const missingId = normalizeRealmPersonaCreateResult({} as RealmModel<'PersonaCharacterCoreDto'>);
    const missingSource = normalizeRealmPersonaCreateResult({
      ...persona,
      contentHash: '',
    });

    expect(missingId).toMatchObject({
      ok: false,
      failure: 'realm-create-persona-missing-canonical-id',
    });
    expect(missingSource).toMatchObject({
      ok: false,
      failure: 'realm-create-persona-missing-canonical-id',
    });
  });
});
