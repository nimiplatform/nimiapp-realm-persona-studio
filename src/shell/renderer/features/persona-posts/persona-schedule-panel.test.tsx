import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureStudioI18nInitialized } from '@renderer/i18n/studio-i18n.js';
import { PERSONA_WORKSPACE_VISUAL_FIXTURE_DETAILS } from '../persona-detail/persona-workspace.visual-fixture.js';
import { buildLocalPostScheduleCandidate, validateLocalPostDraft } from '../portfolio/post-draft.js';
import { loadLocalPostSchedule, saveLocalPostSchedule } from '../portfolio/local-post-schedule-store.js';
import { PersonaSchedulePanel } from './persona-schedule-panel.js';

const persona = PERSONA_WORKSPACE_VISUAL_FIXTURE_DETAILS['visual-xiaomi']!;

beforeEach(async () => {
  window.localStorage.clear();
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

  it('preserves the saved schedule and reports a failed removal', () => {
    const built = buildLocalPostScheduleCandidate(validateLocalPostDraft({
      caption: 'Reviewed copy', tagsText: '', humanReviewed: true,
      attachmentEnabled: false, attachmentTargetType: 'RESOURCE', attachmentTargetId: '',
    }, persona), { localDate: '2099-01-01', localTime: '10:00' });
    if (!built.scheduleable) throw new Error(built.errors.join('; '));
    const schedule = saveLocalPostSchedule(persona.id, built.candidate);
    const onChange = vi.fn();
    render(<PersonaSchedulePanel persona={persona} schedule={schedule} onScheduleChange={onChange} />);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('Storage denied'); });
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear local schedule' })[0]!);
    expect(onChange).not.toHaveBeenCalled();
    expect(loadLocalPostSchedule(persona.id)).toEqual(schedule);
    expect(screen.getByText('The local schedule could not be cleared. It is still saved.')).toBeTruthy();
  });
});
