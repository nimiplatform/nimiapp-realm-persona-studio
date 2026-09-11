import type { NimiLocalAppPersonaCharacterLorebookDeclaration } from '@nimiplatform/sdk/app';

export type CharacterDeclaration = NimiLocalAppPersonaCharacterLorebookDeclaration;
export type CharacterWriting = {
  characterIdentity: string;
  behaviorText: string;
  speakingText: string;
  boundariesText: string;
};
export type CharacterWritingField = keyof CharacterWriting;

// @nimi-authority: rule.realm-persona-studio.setting.r015
// Form feedback mirrors the Realm-owned declaration bounds. The SDK and Realm
// still validate the complete contract and resolve relationship references.
export const CHARACTER_WRITING_LIMITS = {
  characterIdentity: { rows: 1, characters: 240 },
  behaviorText: { rows: 6, characters: 160 },
  speakingText: { rows: 4, characters: 160 },
  boundariesText: { rows: 6, characters: 160 },
} as const;

export function characterLines(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function characterWritingFromDeclaration(
  declaration: CharacterDeclaration | null | undefined,
): CharacterWriting {
  return {
    characterIdentity: declaration?.identity ?? '',
    behaviorText: declaration?.behavior.join('\n') ?? '',
    speakingText: declaration?.speaking.join('\n') ?? '',
    boundariesText: declaration?.immutableBoundaries.join('\n') ?? '',
  };
}

export function characterWritingIssues(writing: CharacterWriting): CharacterWritingField[] {
  return (Object.keys(CHARACTER_WRITING_LIMITS) as CharacterWritingField[]).filter((field) => {
    const limits = CHARACTER_WRITING_LIMITS[field];
    const lines =
      field === 'characterIdentity' ? [writing[field].trim()] : characterLines(writing[field]);
    return (
      lines.length === 0 ||
      lines.length > limits.rows ||
      lines.some((line) => {
        const normalized = line.normalize('NFC');
        return (
          !normalized ||
          [...normalized].length > limits.characters ||
          [...normalized].some((character) => /^[\uD800-\uDFFF]$/u.test(character))
        );
      })
    );
  });
}

export function buildCharacterDeclaration(
  writing: CharacterWriting,
  relationships: CharacterDeclaration['relationshipPostures'] = [],
): CharacterDeclaration {
  if (characterWritingIssues(writing).length > 0) throw new Error('character-writing-invalid');
  const declaration: CharacterDeclaration = {
    identity: writing.characterIdentity.trim(),
    behavior: characterLines(writing.behaviorText),
    speaking: characterLines(writing.speakingText),
    immutableBoundaries: characterLines(writing.boundariesText),
    relationshipPostures: relationships,
  };
  const total = [
    declaration.identity,
    ...declaration.behavior,
    ...declaration.speaking,
    ...declaration.immutableBoundaries,
    ...relationships.map((row) => row.statement),
  ].reduce((sum, value) => sum + [...value.normalize('NFC')].length, 0);
  if (total > 3600) throw new Error('character-writing-invalid');
  return declaration;
}
