import { describe, expect, it } from 'vitest';
import { studioChineseCopy, studioEnglishCopy } from './studio-copy.js';
import {
  ensureStudioI18nInitialized,
  normalizeStudioLocale,
  translatePersonaArchetypeLabel,
  translatePersonaTraitLabel,
  translateStudioCopy,
  studioI18n,
} from './studio-i18n.js';

describe('studio i18n resources', () => {
  it('keeps Chinese resources in exact key parity with English resources', () => {
    expect(Object.keys(studioChineseCopy).sort()).toEqual(Object.keys(studioEnglishCopy).sort());
  });

  it('keeps the known platform reason code out of terminal copy', () => {
    const terminalCopy = [...Object.values(studioEnglishCopy), ...Object.values(studioChineseCopy)];
    expect(terminalCopy.some((value) => value.includes('capability-unavailable'))).toBe(false);
  });

  it('keeps the create entry focused on the user idea instead of internal workflow terms', () => {
    expect(studioChineseCopy['create.title']).toBe('创建角色');
    expect(studioChineseCopy['create.describe.heading']).toBe('你想创建一个怎样的角色？');
    expect(studioChineseCopy['create.describe.hint']).toBe('简单描述即可，不需要一次想完整');
    expect(studioChineseCopy['create.oneLineLabel']).toBe('简单描述一下这个角色');
    expect(studioChineseCopy['create.aiButton.label']).toBe('让 AI 帮我完善角色');
    expect(studioChineseCopy['create.descriptionReroll.label']).toBe('随机生成描述');
    expect(studioChineseCopy['create.aiButton.helper']).toBe('给的信息越多，AI 越贴合你的想法；什么都不写，AI 会自由发挥。生成后可以自由修改');
    expect(studioChineseCopy['create.manualButton.label']).toBe('我想自己填写');
    expect(studioChineseCopy['create.review.basicInfo']).toBe('角色基本信息');
    expect(studioChineseCopy['create.displayNameLabel']).toBe('角色名称');
    expect(studioChineseCopy['create.handleLabel']).toBe('角色ID');
    expect(studioChineseCopy['create.conceptLabel']).toBe('描述');
    expect(studioChineseCopy['create.personaArchetypeLabel']).toBe('角色性格');
    expect(studioChineseCopy['create.personaArchetypePlaceholder']).toBe('选择一种性格基调');
    expect(studioChineseCopy['create.personaTraitsLabel']).toBe('角色特质（最多 {{max}} 个）');
    expect(studioChineseCopy['create.personaTraitsPlaceholder']).toBe('选择几个鲜明特质');
    expect(studioChineseCopy).not.toHaveProperty('create.personaTraitsHardLimit');
    expect(studioChineseCopy).not.toHaveProperty('create.describe.badge');
  });

  it('normalizes supported browser and stored locale values', () => {
    expect(normalizeStudioLocale('zh-CN')).toBe('zh');
    expect(normalizeStudioLocale('en-US')).toBe('en');
    expect(normalizeStudioLocale('fr-FR')).toBeNull();
  });

  it('renders unavailable asset counts without unsupported plural markup', async () => {
    ensureStudioI18nInitialized();
    for (const locale of ['en', 'zh']) {
      await studioI18n.changeLanguage(locale);
      for (const count of [1, 2]) {
        const text = translateStudioCopy('assetsLibrary.unavailableCount', { count });
        expect(text).toContain(String(count));
        expect(text).not.toMatch(/[{}]/);
      }
    }
  });

  it('translates typed Studio copy keys through the active language', async () => {
    ensureStudioI18nInitialized();
    await studioI18n.changeLanguage('zh');
    expect(translateStudioCopy('shell.nav.create')).toBe('创建');

    await studioI18n.changeLanguage('en');
    expect(translateStudioCopy('shell.nav.create')).toBe('Create');
  });

  it('renders Persona trait chips entirely in the active language', async () => {
    ensureStudioI18nInitialized();
    await studioI18n.changeLanguage('zh');
    const chineseTraitLabels = [
      ['HUMOROUS', '幽默 · 风趣机智，妙语连珠'],
      ['SARCASTIC', '讽刺 · 言辞犀利，带点反讽锋芒'],
      ['GENTLE', '温和 · 语气柔和、措辞克制'],
      ['DIRECT', '直率 · 说话直白，直奔主题'],
      ['OPTIMISTIC', '乐观 · 总能看到事物积极的一面'],
      ['REALISTIC', '务实 · 脚踏实地，看重现实可行性'],
      ['DRAMATIC', '戏剧化 · 情感浓烈，极具戏剧张力'],
      ['PASSIONATE', '热情 · 全情投入，充满热忱'],
      ['REBELLIOUS', '叛逆 · 打破常规，不喜束缚'],
      ['INNOCENT', '天真 · 目光纯粹，真诚率直'],
      ['WISE', '睿智 · 深思熟虑，善于提供独到见解'],
      ['ECCENTRIC', '古怪 · 脑回路独特，视角与联想与众不同'],
    ] as const;
    for (const [trait, expected] of chineseTraitLabels) {
      const label = translatePersonaTraitLabel(trait);
      expect(label).toBe(expected);
      expect(label).not.toMatch(/[A-Za-z]/);
      expect(label).not.toMatch(/[。.]$/);
    }

    await studioI18n.changeLanguage('en');
    expect(translatePersonaTraitLabel('HUMOROUS')).toBe('HUMOROUS · Quick wit and timing.');
  });

  it('renders Persona archetype labels entirely in the active language', async () => {
    ensureStudioI18nInitialized();
    await studioI18n.changeLanguage('zh');
    const chineseArchetypeLabels = [
      ['CARING', '关怀型'],
      ['PLAYFUL', '俏皮型'],
      ['INTELLECTUAL', '理智型'],
      ['CONFIDENT', '自信型'],
      ['MYSTERIOUS', '神秘型'],
      ['ROMANTIC', '浪漫型'],
    ] as const;
    for (const [archetype, expected] of chineseArchetypeLabels) {
      const label = translatePersonaArchetypeLabel(archetype);
      expect(label).toBe(expected);
      expect(label).not.toMatch(/[A-Za-z]/);
    }

    await studioI18n.changeLanguage('en');
    expect(translatePersonaArchetypeLabel('CARING')).toBe('CARING · Caring');
  });
});
