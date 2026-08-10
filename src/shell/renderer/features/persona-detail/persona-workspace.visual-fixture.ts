import nanxingAvatarUrl from '@renderer/assets/persona-preview/nanxing-avatar.png?url';
import edenCoverUrl from '@renderer/assets/persona-preview/eden-cover.png?url';
import oasisCoverUrl from '@renderer/assets/persona-preview/oasis-cover.png?url';
import xiaomiAvatarUrl from '@renderer/assets/persona-preview/xiaomi-avatar.png?url';
import type {
  OwnerPortfolioPersona,
  OwnerPortfolioPersonaDetail,
  SettingField,
} from '@renderer/features/portfolio/portfolio-data.js';
import type { PersonaWorkspaceVisualData } from './persona-workspace-visual-data.js';

const DETAIL_SOURCE = 'Realm WorldCoreController.getRealmPersona' as const;
const LIST_SOURCE = 'Realm WorldCoreController.listRealmPersonas' as const;

function field(
  key: SettingField['key'],
  label: string,
  value: string,
): SettingField {
  return {
    key,
    label,
    value,
    status: value ? 'available' : 'available-empty',
    source: DETAIL_SOURCE,
    readOnly: true,
    ...(value ? {} : { emptyLabel: 'not set' as const }),
  };
}

export const PERSONA_WORKSPACE_VISUAL_FIXTURE_LIST: OwnerPortfolioPersona[] = [
  {
    id: 'visual-xiaomi',
    displayName: '小米',
    handle: 'xiaomi',
    coverUrl: oasisCoverUrl,
    avatarUrl: xiaomiAvatarUrl,
    ownerScope: 'owner-created',
    source: LIST_SOURCE,
    realmState: 'PUBLIC',
    worldName: 'OASIS',
    updatedAt: '2026-08-10T09:42:00+08:00',
    friendCount: { status: 'source-unavailable', label: 'friendCount source unavailable' },
  },
  {
    id: 'visual-nanxing',
    displayName: '南星',
    handle: 'nanxing',
    coverUrl: edenCoverUrl,
    avatarUrl: nanxingAvatarUrl,
    ownerScope: 'owner-created',
    source: LIST_SOURCE,
    realmState: 'PUBLIC',
    worldName: 'EDEN',
    updatedAt: '2026-08-09T18:20:00+08:00',
    friendCount: { status: 'source-unavailable', label: 'friendCount source unavailable' },
  },
];

export const PERSONA_WORKSPACE_VISUAL_FIXTURE_DETAILS: Record<string, OwnerPortfolioPersonaDetail> = {
  'visual-xiaomi': {
    id: 'visual-xiaomi',
    displayName: field('displayName', 'Display name', '小米'),
    handle: field('handle', 'Handle', 'xiaomi'),
    bio: field('bio', 'Profile description', '温柔理性、热爱探索的内容创作者，在 OASIS 记录生活与灵感，用真诚的表达连接有趣的灵魂。'),
    greeting: field('greeting', 'Greeting', '你好，我是小米，很高兴认识你。'),
    profileCoverUrl: field('profileCoverUrl', 'Profile cover URL', oasisCoverUrl),
    ownership: field('ownership', 'Ownership evidence', 'owner-created RealmPersona'),
    world: field('world', 'World evidence', 'OASIS'),
    state: field('state', 'State evidence', 'PUBLIC'),
    avatarUrl: xiaomiAvatarUrl,
    contentHash: 'visual-fixture-xiaomi-content-hash',
    contentRevision: 4,
    homeWorldId: 'OASIS',
    voice: {
      voiceId: 'xiaomi-voice-v2',
      description: '温暖、好奇、简洁',
      emotionEnabled: null,
      speed: null,
      pitch: null,
      speechModelId: '',
      speechRoutePolicy: null,
    },
    friendCount: { status: 'source-unavailable', label: 'friendCount source unavailable' },
    ownerScope: 'owner-created',
    source: DETAIL_SOURCE,
  },
  'visual-nanxing': {
    id: 'visual-nanxing',
    displayName: field('displayName', 'Display name', '南星'),
    handle: field('handle', 'Handle', 'nanxing'),
    bio: field('bio', 'Profile description', '关注未来城市与自然共生的观察者，在 EDEN 分享温暖、清醒而富有行动感的日常发现。'),
    greeting: field('greeting', 'Greeting', '你好，我是南星。一起把值得期待的未来讲清楚。'),
    profileCoverUrl: field('profileCoverUrl', 'Profile cover URL', edenCoverUrl),
    ownership: field('ownership', 'Ownership evidence', 'owner-created RealmPersona'),
    world: field('world', 'World evidence', 'EDEN'),
    state: field('state', 'State evidence', 'PUBLIC'),
    avatarUrl: nanxingAvatarUrl,
    contentHash: 'visual-fixture-nanxing-content-hash',
    contentRevision: 2,
    homeWorldId: 'EDEN',
    voice: {
      voiceId: 'nanxing-voice-v1',
      description: '清醒、笃定、温暖',
      emotionEnabled: null,
      speed: null,
      pitch: null,
      speechModelId: '',
      speechRoutePolicy: null,
    },
    friendCount: { status: 'source-unavailable', label: 'friendCount source unavailable' },
    ownerScope: 'owner-created',
    source: DETAIL_SOURCE,
  },
};

export const PERSONA_WORKSPACE_VISUAL_FIXTURE_DATA: Record<string, PersonaWorkspaceVisualData> = {
  'visual-xiaomi': {
    developmentFixture: true,
    traits: ['温柔理性', '探索驱动', '真诚连接'],
    candidates: [
      { id: 'xiaomi-avatar-candidate', kind: 'avatar', label: '头像候选', status: 'candidate-only', imageUrl: xiaomiAvatarUrl },
      { id: 'xiaomi-cover-candidate', kind: 'cover', label: '主页封面候选', status: 'candidate-only', imageUrl: oasisCoverUrl },
      { id: 'xiaomi-voice-candidate', kind: 'voice', label: '声音候选', status: 'candidate-only', fileLabel: 'xiaomi_voice_v2.mp3 · 02:18' },
    ],
    recentDraft: {
      title: '在黎明前的小宇宙里',
      savedLabel: '最后保存：今天 09:42',
      imageUrl: oasisCoverUrl,
    },
    localPlan: {
      title: '探索 OASIS 的八个瞬间',
      runLabel: '今天 20:00 · 仅本机',
    },
    initialPostCaption: '今天的 OASIS 依旧晴朗，空气里带着一点点海水的味道。\n\n早上在湖边散步时，注意到一群小螃蟹在礁石缝里搬家。它们很慢，但一步一步都很认真。\n\n最近在尝试把每天的好奇心记录下来——一个问题、一个观察、一点点感动。把这些小小的瞬间串起来，就成了我喜欢这个世界的理由。',
    initialPostTags: '#OASIS #日常观察 #好奇心',
    postQueue: [
      { id: 'xiaomi-queue-review', title: '在海边捡到一枚会发光的贝壳', state: 'needs-review', editedLabel: '今天 14:27' },
      { id: 'xiaomi-queue-draft', title: '关于我最近在读的一本书', state: 'local-draft', editedLabel: '今天 11:02' },
      { id: 'xiaomi-queue-plan', title: '夜晚的 OASIS，有星星也有你', state: 'local-schedule', editedLabel: '今天 20:00 · 仅本机' },
    ],
  },
  'visual-nanxing': {
    developmentFixture: true,
    traits: ['清醒表达', '未来观察', '温暖行动'],
    candidates: [
      { id: 'nanxing-avatar-candidate', kind: 'avatar', label: '头像候选', status: 'owner-reviewed', imageUrl: nanxingAvatarUrl },
      { id: 'nanxing-cover-candidate', kind: 'cover', label: '主页封面候选', status: 'candidate-only', imageUrl: edenCoverUrl },
      { id: 'nanxing-voice-candidate', kind: 'voice', label: '声音候选', status: 'candidate-only', fileLabel: 'nanxing_voice_v1.mp3 · 01:46' },
    ],
    recentDraft: {
      title: 'EDEN 的清晨为什么更安静',
      savedLabel: '最后保存：昨天 18:20',
      imageUrl: edenCoverUrl,
    },
    localPlan: null,
    initialPostCaption: '今天从 EDEN 的玻璃花园经过，晨光把每一片叶子的边缘都照得很清楚。\n\n好的未来也许不是突然到来的宏大答案，而是我们愿意认真照顾的每一个微小选择。',
    initialPostTags: '#EDEN #未来生活 #城市观察',
    postQueue: [
      { id: 'nanxing-queue-review', title: '城市为什么需要更多可以停留的角落', state: 'needs-review', editedLabel: '昨天 18:20' },
      { id: 'nanxing-queue-draft', title: '把未来写得更具体一点', state: 'local-draft', editedLabel: '昨天 16:08' },
    ],
  },
};

export const PERSONA_WORKSPACE_VISUAL_FIXTURE_PENDING_REVIEWS: Record<string, number> = {
  'visual-xiaomi': 1,
  'visual-nanxing': 1,
};
