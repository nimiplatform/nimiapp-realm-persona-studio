import nanxingAvatarUrl from '@renderer/assets/persona-preview/nanxing-avatar.png?url';
import edenCoverUrl from '@renderer/assets/persona-preview/eden-cover.png?url';
import mengqiAvatarUrl from '@renderer/assets/persona-preview/mengqi-avatar.png?url';
import mengqiCoverUrl from '@renderer/assets/persona-preview/mengqi-cover.png?url';
import oasisCoverUrl from '@renderer/assets/persona-preview/oasis-cover.png?url';
import xiaomiAvatarUrl from '@renderer/assets/persona-preview/xiaomi-avatar.png?url';
import type {
  OwnerPortfolioPersona,
  OwnerPortfolioPersonaDetail,
  SettingField,
} from '@renderer/features/portfolio/portfolio-data.js';
import type { PersonaWorkspaceVisualData } from './persona-workspace-visual-data.js';

function encodeBase64(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let encoded = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const block = (first << 16) | (second << 8) | third;
    encoded += alphabet[(block >> 18) & 63];
    encoded += alphabet[(block >> 12) & 63];
    encoded += index + 1 < bytes.length ? alphabet[(block >> 6) & 63] : '=';
    encoded += index + 2 < bytes.length ? alphabet[block & 63] : '=';
  }
  return encoded;
}

type DevelopmentVoiceTone = {
  baseFrequency: number;
  harmonicFrequency: number;
  attackSeconds: number;
  releaseSeconds: number;
};

const DEFAULT_DEVELOPMENT_VOICE_TONE: DevelopmentVoiceTone = {
  baseFrequency: 125,
  harmonicFrequency: 375,
  attackSeconds: 0.08,
  releaseSeconds: 0.16,
};

function createDevelopmentVoicePreviewDataUrl(tone: DevelopmentVoiceTone = DEFAULT_DEVELOPMENT_VOICE_TONE): string {
  const sampleRate = 8_000;
  const sampleCount = sampleRate;
  const bytes = new Uint8Array(44 + sampleCount);
  const view = new DataView(bytes.buffer);

  function writeText(offset: number, value: string) {
    for (let index = 0; index < value.length; index += 1) {
      bytes[offset + index] = value.charCodeAt(index);
    }
  }

  writeText(0, 'RIFF');
  view.setUint32(4, 36 + sampleCount, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  writeText(36, 'data');
  view.setUint32(40, sampleCount, true);

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    const attack = Math.min(1, time / tone.attackSeconds);
    const release = Math.min(1, (1 - time) / tone.releaseSeconds);
    const envelope = Math.max(0, Math.min(attack, release));
    const voicedTone = (0.62 * Math.sin(2 * Math.PI * tone.baseFrequency * time))
      + (0.2 * Math.sin(2 * Math.PI * tone.harmonicFrequency * time));
    bytes[44 + index] = Math.max(0, Math.min(255, Math.round(128 + (82 * envelope * voicedTone))));
  }

  return `data:audio/wav;base64,${encodeBase64(bytes)}`;
}

const DETAIL_SOURCE = 'Nimi App Access realm.personaCharacter.getOwned' as const;
const LIST_SOURCE = 'Nimi App Access realm.personaCharacter.listOwned' as const;
const DEV_VOICE_PREVIEW_DATA_URL = createDevelopmentVoicePreviewDataUrl();
const DEV_VOICE_PREVIEW_MENGQI_DATA_URL = createDevelopmentVoicePreviewDataUrl({
  baseFrequency: 220,
  harmonicFrequency: 660,
  attackSeconds: 0.18,
  releaseSeconds: 0.3,
});

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
    visibility: 'public',
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
    visibility: 'public',
    worldName: 'EDEN',
    updatedAt: '2026-08-09T18:20:00+08:00',
    friendCount: { status: 'source-unavailable', label: 'friendCount source unavailable' },
  },
  {
    id: 'visual-mengqi',
    displayName: '梦琦·拾光',
    handle: 'mengqi',
    coverUrl: mengqiCoverUrl,
    avatarUrl: mengqiAvatarUrl,
    ownerScope: 'owner-created',
    source: LIST_SOURCE,
    visibility: 'public',
    worldName: 'NEBULA',
    updatedAt: '2026-08-14T10:18:00+08:00',
    friendCount: { status: 'source-unavailable', label: 'friendCount source unavailable' },
  },
  {
    id: 'visual-chenwu',
    displayName: '晨雾',
    handle: 'chenwu',
    coverUrl: null,
    avatarUrl: null,
    ownerScope: 'owner-created',
    source: LIST_SOURCE,
    visibility: 'private',
    worldName: 'AURORA',
    updatedAt: '2026-08-11T15:10:00+08:00',
    friendCount: { status: 'source-unavailable', label: 'friendCount source unavailable' },
  },
  {
    id: 'visual-xinglan',
    displayName: '星澜',
    handle: 'xinglan',
    coverUrl: null,
    avatarUrl: null,
    ownerScope: 'owner-created',
    source: LIST_SOURCE,
    visibility: 'private',
    worldName: 'NEBULA',
    updatedAt: '2026-08-12T10:30:00+08:00',
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
    ownership: field('ownership', 'Ownership evidence', 'owner-scoped PersonaCharacter'),
    world: field('world', 'World evidence', 'OASIS'),
    visibility: field('visibility', 'Visibility', 'public'),
    avatarUrl: xiaomiAvatarUrl,
    contentHash: 'visual-fixture-xiaomi-content-hash',
    sourceHash: 'visual-fixture-xiaomi-source-hash',
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
    ownership: field('ownership', 'Ownership evidence', 'owner-scoped PersonaCharacter'),
    world: field('world', 'World evidence', 'EDEN'),
    visibility: field('visibility', 'Visibility', 'public'),
    avatarUrl: nanxingAvatarUrl,
    contentHash: 'visual-fixture-nanxing-content-hash',
    sourceHash: 'visual-fixture-nanxing-source-hash',
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
  'visual-mengqi': {
    id: 'visual-mengqi',
    displayName: field('displayName', 'Display name', '梦琦·拾光'),
    handle: field('handle', 'Handle', 'mengqi'),
    bio: field('bio', 'Profile description', '梦琦，一位修补梦境碎片的神秘旅人。她在 NEBULA 收集散落的遗憾时光，把它们一片一片缝回完整的夜晚。'),
    greeting: field('greeting', 'Greeting', '你好，我是梦琦。我能进入你的梦境，替你修补那些破碎的时光片段。'),
    profileCoverUrl: field('profileCoverUrl', 'Profile cover URL', mengqiCoverUrl),
    ownership: field('ownership', 'Ownership evidence', 'owner-scoped PersonaCharacter'),
    world: field('world', 'World evidence', 'NEBULA'),
    visibility: field('visibility', 'Visibility', 'public'),
    avatarUrl: mengqiAvatarUrl,
    contentHash: 'visual-fixture-mengqi-content-hash',
    sourceHash: 'visual-fixture-mengqi-source-hash',
    contentRevision: 3,
    homeWorldId: 'NEBULA',
    voice: {
      voiceId: 'mengqi-voice-v1',
      description: '空灵、安静、治愈',
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
  'visual-chenwu': {
    id: 'visual-chenwu',
    displayName: field('displayName', 'Display name', '晨雾'),
    handle: field('handle', 'Handle', 'chenwu'),
    bio: field('bio', 'Profile description', '喜欢收集清晨的声音与光线，在 AURORA 记录缓慢生长的想法。'),
    greeting: field('greeting', 'Greeting', '你好，我是晨雾。'),
    profileCoverUrl: field('profileCoverUrl', 'Profile cover URL', ''),
    ownership: field('ownership', 'Ownership evidence', 'owner-scoped PersonaCharacter'),
    world: field('world', 'World evidence', 'AURORA'),
    visibility: field('visibility', 'Visibility', 'private'),
    avatarUrl: null,
    contentHash: 'visual-fixture-chenwu-content-hash',
    sourceHash: 'visual-fixture-chenwu-source-hash',
    contentRevision: 1,
    homeWorldId: 'AURORA',
    friendCount: { status: 'source-unavailable', label: 'friendCount source unavailable' },
    ownerScope: 'owner-created',
    source: DETAIL_SOURCE,
  },
  'visual-xinglan': {
    id: 'visual-xinglan',
    displayName: field('displayName', 'Display name', '星澜'),
    handle: field('handle', 'Handle', 'xinglan'),
    bio: field('bio', 'Profile description', '在 NEBULA 记录星光、潮汐与缓慢成形的想法。'),
    greeting: field('greeting', 'Greeting', '你好，我是星澜。'),
    profileCoverUrl: field('profileCoverUrl', 'Profile cover URL', ''),
    ownership: field('ownership', 'Ownership evidence', 'owner-scoped PersonaCharacter'),
    world: field('world', 'World evidence', 'NEBULA'),
    visibility: field('visibility', 'Visibility', 'private'),
    avatarUrl: null,
    contentHash: 'visual-fixture-xinglan-content-hash',
    sourceHash: 'visual-fixture-xinglan-source-hash',
    contentRevision: 1,
    homeWorldId: 'NEBULA',
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
      {
        id: 'xiaomi-voice-candidate',
        kind: 'voice',
        label: '声音候选',
        status: 'candidate-only',
        selected: true,
        fileName: 'xiaomi_voice_v2.wav',
        mimeType: 'audio/wav',
        durationSeconds: 1,
        fileSizeBytes: 8044,
        previewUrl: DEV_VOICE_PREVIEW_DATA_URL,
        sourceKind: 'imported',
        selectedAt: '2026-08-13T09:42:00+08:00',
        voiceStyle: '温暖、好奇、简洁',
      },
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
      {
        id: 'xiaomi-queue-review',
        title: '在海边捡到一枚会发光的贝壳',
        body: '在海边捡到一枚会发光的贝壳。\n\n它躺在退潮后的沙地上，像一小片没睡醒的月光。我把它举到耳边，听见的不只是海，还有很久很久以前，浪花第一次学会温柔的声音。\n\n想把它做成一盏小小的灯塔，放在窗台上，等夜里起雾的时候点亮。',
        tagsText: '#OASIS #海边拾物 #日常观察',
        state: 'needs-review',
        editedLabel: '今天 14:27',
        categoryLabel: '日常',
      },
      {
        id: 'xiaomi-queue-draft',
        title: '关于我最近在读的一本书',
        body: '关于我最近在读的一本书。\n\n书里说，好奇心不是因为世界很大，而是因为我们愿意凑近看。一只螃蟹搬家要走完一整块礁石，一片云变淡要用完一整个下午。\n\n读到一半突然很想问问你们：最近是哪一句话，让你愿意停下来？',
        tagsText: '#读书笔记 #好奇心',
        state: 'local-draft',
        editedLabel: '今天 11:02',
        categoryLabel: '创作',
      },
      {
        id: 'xiaomi-queue-plan',
        title: '夜晚的 OASIS，有星星也有你',
        body: '夜晚的 OASIS，有星星也有你。\n\n今晚 20:00，想把白天没说完的话，慢慢讲给星空听。',
        tagsText: '#OASIS #夜晚',
        state: 'local-schedule',
        editedLabel: '今天 20:00 · 仅本机',
      },
      {
        id: 'xiaomi-queue-morning',
        title: '湖边晨跑路线的小小更新',
        body: '湖边晨跑路线的小小更新。\n\n今天把路线延长到了旧码头。木板被晒得暖暖的，跑上去会发出很轻的响声，像在替我数步子。',
        tagsText: '#晨跑 #日常',
        state: 'local-draft',
        editedLabel: '昨天 07:48',
        categoryLabel: '日常',
      },
      {
        id: 'xiaomi-queue-crab',
        title: '为什么小螃蟹搬家要走之字形',
        body: '为什么小螃蟹搬家要走之字形？\n\n观察了三天还是没有答案。但它们每一步都很确定的样子，让我觉得"绕路"也许本身就是一种路线。',
        tagsText: '#日常观察 #好奇心',
        state: 'local-draft',
        editedLabel: '周一 16:20',
        categoryLabel: '日常',
      },
    ],
  },
  'visual-nanxing': {
    developmentFixture: true,
    traits: ['清醒表达', '未来观察', '温暖行动'],
    candidates: [
      { id: 'nanxing-avatar-candidate', kind: 'avatar', label: '头像候选', status: 'owner-reviewed', imageUrl: nanxingAvatarUrl },
      { id: 'nanxing-cover-candidate', kind: 'cover', label: '主页封面候选', status: 'candidate-only', imageUrl: edenCoverUrl },
      {
        id: 'nanxing-voice-candidate',
        kind: 'voice',
        label: '声音候选',
        status: 'candidate-only',
        selected: true,
        fileName: 'nanxing_voice_v1.wav',
        mimeType: 'audio/wav',
        durationSeconds: 1,
        fileSizeBytes: 8044,
        previewUrl: DEV_VOICE_PREVIEW_DATA_URL,
        sourceKind: 'imported',
        selectedAt: '2026-08-13T14:32:00+08:00',
        voiceStyle: '清醒、笃定、温暖',
      },
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
      {
        id: 'nanxing-queue-review',
        title: '城市为什么需要更多可以停留的角落',
        body: '城市为什么需要更多可以停留的角落？\n\n今天路过 EDEN 的中央廊道，看到有人坐在台阶上发呆，没有人催促他。一座好的城市，也许就是从"允许停留"开始的。',
        tagsText: '#EDEN #城市观察',
        state: 'needs-review',
        editedLabel: '昨天 18:20',
        categoryLabel: '公告',
      },
      {
        id: 'nanxing-queue-draft',
        title: '把未来写得更具体一点',
        body: '把未来写得更具体一点。\n\n不说"会更好"，而说"明天早上，阳光会准时落在玻璃花园的第三排长椅上"。具体的未来，才值得被认真照顾。',
        tagsText: '#未来生活',
        state: 'local-draft',
        editedLabel: '昨天 16:08',
        categoryLabel: '日常',
      },
    ],
  },
  'visual-mengqi': {
    developmentFixture: true,
    traits: ['神秘安静', '梦境修补', '温柔守护'],
    candidates: [
      { id: 'mengqi-avatar-candidate', kind: 'avatar', label: '头像候选', status: 'owner-reviewed', imageUrl: mengqiAvatarUrl },
      { id: 'mengqi-cover-candidate', kind: 'cover', label: '主页封面候选', status: 'candidate-only', imageUrl: mengqiCoverUrl },
      {
        id: 'mengqi-voice-candidate',
        kind: 'voice',
        label: '声音候选',
        status: 'candidate-only',
        selected: true,
        fileName: 'mengqi_voice_v1.wav',
        mimeType: 'audio/wav',
        durationSeconds: 1,
        fileSizeBytes: 8044,
        previewUrl: DEV_VOICE_PREVIEW_MENGQI_DATA_URL,
        sourceKind: 'generated',
        selectedAt: '2026-08-14T10:18:00+08:00',
        voiceStyle: '空灵、安静、治愈',
      },
    ],
    recentDraft: {
      title: '昨晚补好的那一片月光',
      savedLabel: '最后保存：今天 07:58',
      imageUrl: mengqiCoverUrl,
    },
    localPlan: {
      title: '给梦境碎片的十二封回信',
      runLabel: '今天 22:30 · 仅本机',
    },
    initialPostCaption: '今夜的梦境集市打烊得很早，我捡到了三片碎掉的月光。\n\n有一片来自一个没说完的道歉，有一片来自站台上目送列车离开的人。我把它们放在银碗里慢慢温着，等边缘不再锋利，再一针一线缝回主人的梦里。\n\n修补不是抹去裂痕，而是让光能从裂痕里照进来。晚安，愿你的梦完整而温柔。',
    initialPostTags: '#梦境修补 #拾光 #NEBULA',
    postQueue: [
      {
        id: 'mengqi-queue-review',
        title: '关于那场迟到了十年的雪',
        body: '关于那场迟到了十年的雪。\n\n有人的梦里一直停着一场没有落下的雪。今晚我把它从云后面请了出来，落得很慢，慢到足够说完一句原谅。',
        tagsText: '#梦境手记 #NEBULA',
        state: 'needs-review',
        editedLabel: '今天 09:16',
        categoryLabel: '梦境手记',
      },
      {
        id: 'mengqi-queue-draft',
        title: '银碗里的月光要怎么温',
        body: '银碗里的月光要怎么温？\n\n火候不能急。先让碗壁暖起来，再把月光一片一片放进去，等它们自己想起完整的形状。',
        tagsText: '#梦境修补',
        state: 'local-draft',
        editedLabel: '昨天 23:41',
        categoryLabel: '创作',
      },
      {
        id: 'mengqi-queue-plan',
        title: '子夜巡梦路线：从钟楼到灯塔',
        body: '子夜巡梦路线：从钟楼到灯塔。\n\n今晚 22:30 出发，沿途收集三枚没做完的梦，送到灯塔上晾干。',
        tagsText: '#巡梦 #NEBULA',
        state: 'local-schedule',
        editedLabel: '今天 22:30 · 仅本机',
      },
    ],
  },
  'visual-chenwu': {
    developmentFixture: true,
    traits: ['安静观察', '细腻表达', '自然灵感'],
    candidates: [],
    recentDraft: null,
    localPlan: null,
    initialPostCaption: '',
    initialPostTags: '',
    postQueue: [],
  },
  'visual-xinglan': {
    developmentFixture: true,
    traits: ['安静探索', '星空观察', '克制表达'],
    candidates: [],
    recentDraft: null,
    localPlan: null,
    initialPostCaption: '',
    initialPostTags: '',
    postQueue: [],
  },
};

export const PERSONA_WORKSPACE_VISUAL_FIXTURE_PENDING_REVIEWS: Record<string, number> = {
  'visual-xiaomi': 1,
  'visual-nanxing': 1,
  'visual-mengqi': 1,
  'visual-chenwu': 0,
  'visual-xinglan': 0,
};
