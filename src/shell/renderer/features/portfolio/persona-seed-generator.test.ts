import type {
  NimiAppPermissionStatus,
  NimiLocalAppTextCandidateInput,
} from '@nimiplatform/sdk/app';
import { describe, expect, it, vi } from 'vitest';
import {
  generatePersonaSeedFromDescription,
  parsePersonaSeedOutput,
  type PersonaSeedLocalAppClient,
} from './persona-seed-generator.js';

const validSeed = {
  handle: 'mira-prime',
  displayName: 'Mira Prime',
  concept: 'Operational guide for artifact reviews.',
  description: 'Mira helps owners shape and review public persona behavior.',
  ruleText: 'Keep output practical.',
  personaArchetype: 'INTELLECTUAL',
  personaTraits: ['WISE', 'DIRECT'],
  rationale: 'Matches the owner brief.',
};

describe('persona seed Runtime output parser', () => {
  it('parses a strict single JSON object into owner-reviewed draft fields', () => {
    expect(parsePersonaSeedOutput(JSON.stringify(validSeed))).toMatchObject({
      seed: {
        handle: 'mira-prime',
        displayName: 'Mira Prime',
        personaArchetype: 'INTELLECTUAL',
        personaTraits: ['WISE', 'DIRECT'],
      },
      rationale: 'Matches the owner brief.',
    });
  });

  it('rejects wrapper text, code fences, and unknown fields', () => {
    expect(() => parsePersonaSeedOutput(`Here is a draft:\n${JSON.stringify(validSeed)}`))
      .toThrow('single JSON object');
    expect(() => parsePersonaSeedOutput(`\`\`\`json\n${JSON.stringify(validSeed)}\n\`\`\``))
      .toThrow('single JSON object');
    expect(() => parsePersonaSeedOutput(JSON.stringify({
      ...validSeed,
      model: 'forbidden',
    }))).toThrow('unknown field model');
    expect(() => parsePersonaSeedOutput(JSON.stringify({
      ...validSeed,
      publicBio: 'unsupported alias',
    }))).toThrow('unknown field publicBio');
  });
});

const grantedStatus = {
  permissionId: 'ai.text.generate',
  posture: 'granted',
  canRequest: false,
  agents: [],
} satisfies NimiAppPermissionStatus;

describe('persona seed Local App generation', () => {
  it('uses the exact protected text-candidate operation without caller-selected route fields', async () => {
    const generateCandidate = vi.fn(async (_input: NimiLocalAppTextCandidateInput) => ({
      text: JSON.stringify(validSeed),
      finishReason: 'stop' as const,
      traceId: 'trace-persona-seed',
    }));
    const request = vi.fn(async () => grantedStatus);
    const client: PersonaSeedLocalAppClient = {
      permissions: {
        status: vi.fn(async () => grantedStatus),
        request,
      },
      ai: { text: { generateCandidate } },
    };

    const result = await generatePersonaSeedFromDescription('A practical persona designer', client, {
      speechSupplement: 'Speak in calm, direct sentences.',
      boundarySupplement: 'Do not claim private memory.',
      visualSupplement: 'Use a cool night palette.',
    });

    expect(result.ok).toBe(true);
    expect(request).not.toHaveBeenCalled();
    expect(generateCandidate).toHaveBeenCalledOnce();
    const submitted = generateCandidate.mock.calls[0]?.[0];
    expect(Object.keys(submitted ?? {})).toEqual(['messages', 'temperature', 'topP', 'maxTokens']);
    expect(submitted?.messages.map((message) => Object.keys(message))).toEqual([
      ['role', 'text'],
      ['role', 'text'],
    ]);
    expect(submitted?.messages[1]?.text).toContain('Speak in calm, direct sentences.');
    expect(submitted?.messages[1]?.text).toContain('Do not claim private memory.');
    expect(submitted?.messages[1]?.text).toContain('Use a cool night palette.');
    expect(result).toMatchObject({
      ok: true,
      seed: { handle: 'mira-prime', displayName: 'Mira Prime' },
      runtime: { traceId: 'trace-persona-seed', finishReason: 'stop' },
    });
  });

  it('requests permission once and does not generate while Desktop approval is pending', async () => {
    const promptStatus = {
      permissionId: 'ai.text.generate',
      posture: 'prompt',
      canRequest: true,
      agents: [],
    } satisfies NimiAppPermissionStatus;
    const pendingStatus = {
      permissionId: 'ai.text.generate',
      posture: 'pending',
      canRequest: false,
      agents: [],
    } satisfies NimiAppPermissionStatus;
    const request = vi.fn(async () => pendingStatus);
    const generateCandidate = vi.fn();
    const client: PersonaSeedLocalAppClient = {
      permissions: {
        status: vi.fn(async () => promptStatus),
        request,
      },
      ai: { text: { generateCandidate } },
    };

    const result = await generatePersonaSeedFromDescription('A practical persona designer', client);

    expect(request).toHaveBeenCalledWith({
      permissionId: 'ai.text.generate',
      reason: 'Generate an owner-reviewed Realm Persona draft from the owner description.',
    });
    expect(generateCandidate).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      failure: 'persona-seed-permission-required',
      submitted: null,
    });
  });
});
