import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureStudioI18nInitialized } from '@renderer/i18n/studio-i18n.js';
import { PERSONA_WORKSPACE_VISUAL_FIXTURE_DETAILS } from '../persona-detail/persona-workspace.visual-fixture.js';
import { buildLocalPostScheduleCandidate, validateLocalPostDraft } from '../portfolio/post-draft.js';
import { loadLocalPostSchedule, saveLocalPostSchedule } from '../portfolio/local-post-schedule-store.js';
import { PersonaSchedulePanel } from './persona-schedule-panel.js';

const persona = PERSONA_WORKSPACE_VISUAL_FIXTURE_DETAILS['visual-xiaomi']!;

const { values, removeJson } = vi.hoisted(() => ({
  values: new Map<string, unknown>(),
  removeJson: vi.fn(),
}));
vi.mock('@renderer/app-shell/studio-storage.js', () => ({
  getStudioProtectedJsonStorage: () => ({
    readJson: async (path: string) => {
      if (!values.has(path)) throw { code: 'not-found' };
      return { value: values.get(path), sizeBytes: 1 };
    },
    writeJson: async (path: string, value: unknown) => {
      values.set(path, value);
      return { value, sizeBytes: 1 };
    },
    removeJson,
  }),
  isStudioStorageNotFoundError: (error: { code?: string }) => error.code === 'not-found',
}));

beforeEach(async () => {
  values.clear();
  removeJson.mockReset().mockImplementation(async (path: string) => ({ removed: values.delete(path) }));
  await ensureStudioI18nInitialized().changeLanguage('en');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('schedule review and storage failures', () => {
  it('requires renewed review after the caption changes', () => {
    render(<PersonaSchedulePanel persona={persona} schedule={null} onScheduleChange={vi.fn()} />);
    const reviewed = screen.getByRole('checkbox') as HTMLInputElement;
    fireEvent.click(reviewed);
    expect(reviewed.checked).toBe(true);
    fireEvent.change(screen.getByRole('textbox', { name: 'Scheduled post copy' }), { target: { value: 'Revised copy' } });
    expect(reviewed.checked).toBe(false);
  });

  it('preserves the saved schedule and reports a failed removal', async () => {
    const built = buildLocalPostScheduleCandidate(validateLocalPostDraft({
      caption: 'Reviewed copy', tagsText: '', humanReviewed: true,
      attachmentEnabled: false, attachmentTargetType: 'RESOURCE', attachmentTargetId: '',
    }, persona), { localDate: '2099-01-01', localTime: '10:00' });
    if (!built.scheduleable) throw new Error(built.errors.join('; '));
    const schedule = await saveLocalPostSchedule(persona.id, built.candidate);
    const onChange = vi.fn();
    render(<PersonaSchedulePanel persona={persona} schedule={schedule} onScheduleChange={onChange} />);
    removeJson.mockRejectedValueOnce(new Error('Storage denied'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear local schedule' })[0]!);
    expect(onChange).not.toHaveBeenCalled();
    expect(await loadLocalPostSchedule(persona.id)).toEqual(schedule);
    expect(await screen.findByText('The local schedule could not be cleared. It is still saved.')).toBeTruthy();
  });

  it('allows a future date and persists the reviewed candidate through protected storage', async () => {
    const onChange = vi.fn();
    render(<PersonaSchedulePanel persona={persona} schedule={null} onScheduleChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Scheduled post copy' }), { target: { value: 'Future reviewed copy' } });
    const date = screen.getByLabelText('Local date') as HTMLInputElement;
    expect(date.type).toBe('date');
    expect(date.max).toBe('');
    fireEvent.change(date, { target: { value: '2099-01-01' } });
    fireEvent.change(screen.getByLabelText('Local time'), { target: { value: '10:00' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Save local schedule' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    expect(await loadLocalPostSchedule(persona.id)).toMatchObject({
      localRunAt: '2099-01-01T10:00',
      candidate: { postCandidate: { realmCreatePost: { caption: 'Future reviewed copy' } } },
    });
  });
});
