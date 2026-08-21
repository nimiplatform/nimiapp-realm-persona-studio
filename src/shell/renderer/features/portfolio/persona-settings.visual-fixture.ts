import type { OwnerPortfolioPersonaDetail } from './portfolio-data.js';
import {
  PERSONA_ARCHETYPES,
  PERSONA_TRAITS,
  type PersonaArchetype,
  type PersonaTrait,
} from './create-persona-draft.js';
import type {
  RealmOwnerPersonaSettings,
  RealmPersonaVisibilitySettings,
} from './portfolio-settings-client.js';

// Development-only visual fixture for the persona settings tab. These builders
// derive mock owner settings from the persona's basic profile fields so the
// designed settings UI can be reviewed before the platform opens the real
// settings surface. Production builds never enable the mock flag.

function readFieldValue(field: OwnerPortfolioPersonaDetail['displayName']): string {
  return field.status === 'available' || field.status === 'available-empty'
    ? field.value.trim()
    : '';
}

function pickVisualFixturePersonaStyle(personaId: string): { archetype: PersonaArchetype; traits: PersonaTrait[] } {
  let hash = 0;
  for (const character of personaId) {
    hash = (hash + character.charCodeAt(0)) % 997;
  }
  const archetype = PERSONA_ARCHETYPES[hash % PERSONA_ARCHETYPES.length] ?? 'CARING';
  const firstTrait = PERSONA_TRAITS[hash % PERSONA_TRAITS.length] ?? 'GENTLE';
  const secondTrait = PERSONA_TRAITS[(hash + 5) % PERSONA_TRAITS.length] ?? 'OPTIMISTIC';
  const thirdTrait = PERSONA_TRAITS[(hash + 9) % PERSONA_TRAITS.length] ?? 'WISE';
  const traits = [...new Set([firstTrait, secondTrait, thirdTrait])].slice(0, 3);
  return { archetype, traits };
}

export function buildVisualFixtureOwnerPersonaSettings(
  persona: OwnerPortfolioPersonaDetail,
): RealmOwnerPersonaSettings {
  const displayName = readFieldValue(persona.displayName) || '未命名角色';
  const description = readFieldValue(persona.bio);
  const greeting = readFieldValue(persona.greeting);
  const worldName = readFieldValue(persona.world) || persona.homeWorldId || 'OASIS';
  const isPublic = readFieldValue(persona.state) === 'PUBLIC';
  const personaStyle = pickVisualFixturePersonaStyle(persona.id);

  const identity = {
    publicRole: `${worldName} 的公开内容创作者`,
    worldview: `相信 ${worldName} 里每一个微小的日常都值得被认真记录，也愿意把观察到的美好分享给更多人。`,
  };
  const personality = {
    summary: `${displayName}性格温暖理性、好奇心旺盛，喜欢用细腻而真诚的表达记录生活，回复时先倾听再回应。`,
    relationshipMode: '像朋友一样平等、自然地交流',
    interests: ['生活观察', '摄影与图片记录', '散步与城市漫游', '阅读与写作'],
    goals: [`持续记录 ${worldName} 里的日常与灵感`, '用真诚的表达连接有趣的灵魂'],
  };
  const communication = {
    contentStyle: '温暖细腻的随笔式记录，句子简短，多观察、少评判，偶尔带一点幽默。',
    formality: 'casual' as const,
    responseLength: 'medium' as const,
    sentiment: 'positive' as const,
  };
  const boundaries = {
    allowedThemes: ['日常生活', '自然与城市观察', '阅读与灵感', '轻量的心情分享'],
    disallowedThemes: ['人身攻击', '隐私打探', '引战与消极对抗话题'],
  };
  const positioning = {
    targetAudience: '喜欢慢节奏内容、愿意认真读完一段文字的同路人。',
    positioning: `${worldName} 里温暖、清醒的日常记录者。`,
  };

  return {
    id: persona.id,
    contentHash: persona.contentHash,
    homeWorldId: persona.homeWorldId,
    visibility: isPublic ? 'public' : 'private',
    origin: { kind: 'manual' },
    core: {
      identity: {
        name: displayName,
        ...(description ? { summary: description } : {}),
      },
      presentation: {
        displayName,
        ...(description ? { profileLine: description } : {}),
      },
      interactionProfile: greeting ? { greeting } : {},
      authoring: {
        extensions: {
          ownerSettings: {
            description: description || null,
            naturalLanguageIntent: null,
            personaStyle,
            identity,
            personality,
            communication,
            boundaries,
            positioning,
          },
        },
      },
    },
    displayName,
    description: description || null,
    greeting: greeting || null,
    naturalLanguageIntent: null,
    identity,
    personality,
    communication,
    boundaries,
    positioning,
  };
}

export function buildVisualFixturePersonaVisibilitySettings(
  persona: OwnerPortfolioPersonaDetail,
): RealmPersonaVisibilitySettings {
  const isPublic = readFieldValue(persona.state) === 'PUBLIC';
  if (isPublic) {
    return {
      defaultPostVisibility: 'PUBLIC',
      dmVisibility: 'FRIENDS',
      profileVisibility: 'PUBLIC',
    };
  }
  return {
    defaultPostVisibility: 'PRIVATE',
    dmVisibility: 'PRIVATE',
    profileVisibility: 'PRIVATE',
  };
}
