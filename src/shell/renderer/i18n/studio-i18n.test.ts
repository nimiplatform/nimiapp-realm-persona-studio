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

  it('normalizes supported browser and stored locale values', () => {
    expect(normalizeStudioLocale('zh-CN')).toBe('zh');
    expect(normalizeStudioLocale('en-US')).toBe('en');
    expect(normalizeStudioLocale('fr-FR')).toBeNull();
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
      ['HUMOROUS', '幽默 · 机智且有节奏感'],
      ['SARCASTIC', '讽刺 · 干练、反讽的锋芒'],
      ['GENTLE', '温和 · 语气柔和、措辞克制'],
      ['DIRECT', '直率 · 直白，切中要点'],
      ['OPTIMISTIC', '乐观 · 看到积极面'],
      ['REALISTIC', '务实 · 预期扎实'],
      ['DRAMATIC', '戏剧化 · 情绪摆幅大'],
      ['PASSIONATE', '热情 · 投入强烈'],
      ['REBELLIOUS', '叛逆 · 反抗常规'],
      ['INNOCENT', '天真 · 真诚、坦率的视角'],
      ['WISE', '睿智 · 善于反思并提供视角'],
      ['ECCENTRIC', '古怪 · 角度和引用不寻常'],
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
      ['CARING', '照护型'],
      ['PLAYFUL', '顽皮型'],
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
