import { beforeEach, describe, expect, it, vi } from 'vitest';

const personaCharacter = vi.hoisted(() => ({
  listOwned: vi.fn(),
  getOwned: vi.fn(),
  create: vi.fn(),
  replace: vi.fn(),
  toProfileInput: vi.fn(),
}));

vi.mock('@renderer/app-shell/studio-platform.js', () => ({
  getStudioLocalAppClient: () => ({ realm: { personaCharacter } }),
}));

import {
  buildRealmCreatePersonaInput,
  checkCreateRealmPersonaHandleAvailability,
  createReviewedRealmPersona,
  createReviewedRealmPersonaWithProfileSettings,
  getOwnerPortfolioPersonaDetail,
  listOwnerPortfolioPersonas,
} from './portfolio-client.js';
import { createPayload, persona } from './portfolio-client.test-helpers.js';

describe('owner PersonaCharacter portfolio client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    personaCharacter.listOwned.mockResolvedValue({ items: [] });
    personaCharacter.getOwned.mockResolvedValue(persona);
    personaCharacter.create.mockResolvedValue(persona);
  });

  it('uses the host-injected owner client and follows every nextAfterId page', async () => {
    personaCharacter.listOwned
      .mockResolvedValueOnce({ items: [persona], nextAfterId: persona.id })
      .mockResolvedValueOnce({ items: [{ ...persona, id: 'persona-2' }] });

    const listed = await listOwnerPortfolioPersonas();

    expect(listed.map((item) => item.id)).toEqual(['persona-1', 'persona-2']);
    expect(personaCharacter.listOwned).toHaveBeenNthCalledWith(1, { take: 500 });
    expect(personaCharacter.listOwned).toHaveBeenNthCalledWith(2, { take: 500, afterId: 'persona-1' });
  });

  it('reads owner detail through getOwned and keeps the canonical safe projection', async () => {
    const detail = await getOwnerPortfolioPersonaDetail('persona-1');

    expect(personaCharacter.getOwned).toHaveBeenCalledWith('persona-1');
    expect(detail).toMatchObject({
      id: 'persona-1',
      contentHash: persona.contentHash,
      visibility: { value: 'public' },
    });
    expect(detail.canonical).toBe(persona);
  });

  it('uses the complete owner portfolio only as an advisory handle preflight', async () => {
    personaCharacter.listOwned.mockResolvedValue({ items: [persona] });

    const result = await checkCreateRealmPersonaHandleAvailability('MIRA');

    expect(result).toMatchObject({
      ok: true,
      truthWrite: false,
      availability: { available: false, normalized: 'mira' },
    });
  });

  it('builds and submits the exact App create DTO without caller authority fields', async () => {
    const input = buildRealmCreatePersonaInput(createPayload);
    const result = await createReviewedRealmPersonaWithProfileSettings(createPayload);

    expect(input).toEqual(createPayload.body);
    expect(input).not.toHaveProperty('account');
    expect(input).not.toHaveProperty('ownerAccountId');
    expect(input).not.toHaveProperty('scope');
    expect(personaCharacter.create).toHaveBeenCalledWith(createPayload.body);
    expect(result).toMatchObject({
      ok: true,
      canonical: {
        id: 'persona-1',
        contentHash: persona.contentHash,
        contentRevision: 1,
        homeWorldId: 'world-oasis',
        visibility: 'public',
      },
      profileSettings: { status: 'not-applicable' },
    });
  });

  it('preserves only the sanitized SDK reason code on create failure', async () => {
    personaCharacter.create.mockRejectedValue(Object.assign(new Error('private upstream detail'), {
      reasonCode: 'content-conflict',
    }));

    const result = await createReviewedRealmPersona(createPayload);

    expect(result).toMatchObject({ ok: false, failure: 'content-conflict', message: 'content-conflict' });
    expect(JSON.stringify(result)).not.toContain('private upstream detail');
  });

  it('fails closed on a repeated pagination cursor', async () => {
    personaCharacter.listOwned
      .mockResolvedValueOnce({ items: [persona], nextAfterId: 'cursor-1' })
      .mockResolvedValueOnce({ items: [persona], nextAfterId: 'cursor-1' });

    await expect(listOwnerPortfolioPersonas()).rejects.toMatchObject({ reasonCode: 'contract-invalid' });
  });

  it('fails the complete portfolio on a duplicate persona across pages', async () => {
    personaCharacter.listOwned
      .mockResolvedValueOnce({ items: [persona], nextAfterId: 'cursor-1' })
      .mockResolvedValueOnce({ items: [persona] });

    await expect(listOwnerPortfolioPersonas()).rejects.toMatchObject({ reasonCode: 'contract-invalid' });
  });
});
