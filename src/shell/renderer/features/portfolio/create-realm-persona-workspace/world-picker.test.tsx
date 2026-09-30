import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureStudioI18nInitialized } from '../../../i18n/studio-i18n.js';
import { REALM_WORLD_CORE_LIST_SOURCE, type SelectableRealmWorld } from '../create-persona-draft.js';
import { WorldPicker } from './world-picker.js';

const worlds: SelectableRealmWorld[] = ['A', 'B', 'C'].map((name) => ({
  id: name, name, identityName: name, type: null, status: null, description: '', tagline: '', source: REALM_WORLD_CORE_LIST_SOURCE,
}));
beforeEach(async () => { await ensureStudioI18nInitialized().changeLanguage('en'); });
afterEach(cleanup);

function showPicker() {
  const close = vi.fn();
  function Picker() {
    const [selected, setSelected] = useState('A');
    return <WorldPicker open worlds={worlds} selectedWorldId={selected} onSelect={setSelected} onClose={close} />;
  }
  render(<Picker />);
  return close;
}

describe('world selection keyboard interaction', () => {
  it('moves focus and selection without closing, and keeps one radio tab stop', () => {
    const close = showPicker();
    const radios = screen.getAllByRole('radio');
    radios[0]!.focus();
    fireEvent.keyDown(radios[0]!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(radios[1]);
    expect(radios[1]!.getAttribute('aria-checked')).toBe('true');
    expect(radios.map((radio) => radio.tabIndex)).toEqual([-1, 0, -1]);
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('wraps at both ends and supports Home and End', () => {
    const close = showPicker();
    const radios = screen.getAllByRole('radio');
    fireEvent.keyDown(radios[0]!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(radios[2]);
    fireEvent.keyDown(radios[2]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(radios[0]);
    fireEvent.keyDown(radios[0]!, { key: 'End' });
    expect(document.activeElement).toBe(radios[2]);
    fireEvent.keyDown(radios[2]!, { key: 'Home' });
    expect(document.activeElement).toBe(radios[0]);
    expect(close).not.toHaveBeenCalled();
  });

  it('commits and closes only when an option is activated', () => {
    const close = showPicker();
    fireEvent.click(screen.getAllByRole('radio')[1]!);
    expect(close).toHaveBeenCalledOnce();
  });

  it('keeps a tab stop after the selected world is filtered out', () => {
    showPicker();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search world names' }), { target: { value: 'B' } });
    expect(screen.getAllByRole('radio').map((radio) => radio.tabIndex)).toEqual([0]);
  });

  it('keeps valid worlds selectable while displaying an unavailable entry without a radio', () => {
    const select = vi.fn();
    render(<WorldPicker open worlds={[{ ...worlds[0]!, id: 'missing-name', name: null }, ...worlds]}
      selectedWorldId="A" onSelect={select} onClose={vi.fn()} />);
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByText(/Unavailable world names: 1/)).toBeTruthy();
    expect(screen.getByText('World temporarily unavailable')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('radio')[1]!);
    expect(select).toHaveBeenCalledWith('B');
  });
});
