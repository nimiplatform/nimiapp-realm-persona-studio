import { describe, expect, it } from 'vitest';
import {
  acceptPersonaCreationGraphForRealmCreate,
  buildPersonaCreationGraphFromDraft,
  validatePersonaCreationGraphForRealmCreate,
  type PersonaCreationGraph,
} from './persona-creation-graph.js';
import type { CreateRealmPersonaDraftInput } from './create-persona-draft.js';

const readyDraft: CreateRealmPersonaDraftInput = {
  handle: 'mira-prime',
  displayName: 'Mira Prime',
  concept: 'A precise operations companion for artifact review.',
  description: 'Mira helps owners review persona behavior before public writes.',
  ruleText: 'Keep output practical.',
  selectedWorldId: 'world-oasis',
  personaArchetype: 'INTELLECTUAL',
  personaTraits: ['WISE', 'DIRECT'],
  referenceImageUrl: 'https://cdn.example.test/mira.png',
  referenceImagePrompt: 'An artifact review Persona portrait.',
  originalDescription: 'An artifact review persona with calm operational judgment.',
};

describe('Persona Creation Graph', () => {
  it('builds source-backed graph sections from a description-originated draft', () => {
    const graph = buildPersonaCreationGraphFromDraft(readyDraft, {
      sourceMode: 'description',
      sourceLabel: readyDraft.originalDescription,
      runtimeRationale: 'The draft is operational and review-focused.',
    });

    expect(graph.sourcePackage.mode).toBe('description');
    expect(graph.sourcePackage.fields.map((field) => field.status)).toContain('mapped');
    expect(graph.normalizedGraph.sections.map((section) => section.key)).toEqual([
      'identity',
      'personaStyle',
      'behavior',
      'worldview',
      'greeting',
      'communicationVoice',
      'contentVoice',
      'visualBrief',
      'voiceBrief',
      'postBrief',
      'sourceProvenance',
      'missingDecisions',
      'riskNotes',
      'writePlan',
    ]);
    expect(graph.writePlan.items.find((item) => item.target === 'realm-create')?.status).toBe('ready');
  });

  it('requires owner graph review before create per R-RPS-GRAPH-019', () => {
    const graph = buildPersonaCreationGraphFromDraft(readyDraft, {
      sourceMode: 'description',
      sourceLabel: readyDraft.originalDescription,
    });

    expect(validatePersonaCreationGraphForRealmCreate(graph, null)).toMatchObject({
      canAccept: true,
      ready: false,
      reviewErrors: ['Persona Creation Graph review missing or stale (R-RPS-GRAPH-019).'],
    });

    const accepted = acceptPersonaCreationGraphForRealmCreate(graph);
    expect(validatePersonaCreationGraphForRealmCreate(graph, accepted)).toMatchObject({
      canAccept: true,
      ready: true,
      errors: [],
    });
  });

  it('blocks invalid graph shapes before Realm create per R-RPS-GRAPH-017', () => {
    const graph = buildPersonaCreationGraphFromDraft({
      ...readyDraft,
      personaArchetype: '',
    }, {
      sourceMode: 'manual',
      sourceLabel: 'Manual advanced entry',
    });
    const accepted = acceptPersonaCreationGraphForRealmCreate(graph);

    expect(validatePersonaCreationGraphForRealmCreate(graph, accepted)).toMatchObject({
      canAccept: false,
      ready: false,
      shapeErrors: ['Persona Creation Graph write plan is blocked for Realm create (R-RPS-GRAPH-017).'],
    });
  });

  it('blocks missing required graph sections per R-RPS-GRAPH-016', () => {
    const graph = buildPersonaCreationGraphFromDraft(readyDraft, {
      sourceMode: 'description',
      sourceLabel: readyDraft.originalDescription,
    });
    const invalid: PersonaCreationGraph = {
      ...graph,
      normalizedGraph: {
        sections: graph.normalizedGraph.sections.filter((section) => section.key !== 'identity'),
      },
    };
    const accepted = acceptPersonaCreationGraphForRealmCreate(invalid);

    expect(validatePersonaCreationGraphForRealmCreate(invalid, accepted).shapeErrors).toContain(
      'Persona Creation Graph section missing: identity (R-RPS-GRAPH-016).',
    );
  });
});
