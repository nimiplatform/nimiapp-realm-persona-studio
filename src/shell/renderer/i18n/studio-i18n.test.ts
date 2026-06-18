import { describe, expect, it } from 'vitest';
import { studioChineseCopy, studioEnglishCopy } from './studio-copy.js';
import {
  ensureStudioI18nInitialized,
  normalizeStudioLocale,
  translateStudioCopy,
  studioI18n,
} from './studio-i18n.js';

describe('studio i18n resources', () => {
  it('keeps Chinese resources in exact key parity with English resources', () => {
    expect(Object.keys(studioChineseCopy).sort()).toEqual(Object.keys(studioEnglishCopy).sort());
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
});
