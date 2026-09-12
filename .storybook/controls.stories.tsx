import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CharacterWritingFields } from '../src/shell/renderer/features/persona-workshop/character-writing-fields.js';
import { StudioVoiceSelector } from '../src/shell/renderer/features/portfolio/studio-voice-selector.js';

const meta = { title: 'Studio/Review controls', parameters: { layout: 'padded' } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
function Writing({ invalid = false }: { invalid?: boolean }) {
  const [value, setValue] = useState({
    characterIdentity: invalid ? '' : '一位整理灯塔书信的修信人。',
    behaviorText: '先倾听，再问一个具体的问题。',
    speakingText: '短句，温和。',
    boundariesText: '不编造共同经历。',
  });
  return <CharacterWritingFields value={value} onChange={(patch) => setValue({ ...value, ...patch })} showErrors />;
}
export const WritingDraft: Story = { render: () => <Writing /> };
export const WritingInvalid: Story = { render: () => <Writing invalid /> };
export const VoiceLoading: Story = { render: () => <StudioVoiceSelector value="" onChange={() => {}} catalogue={{ voices: [], loading: true, unavailable: false, refresh: () => {} }} /> };
export const VoiceUnavailable: Story = { render: () => <StudioVoiceSelector value="" onChange={() => {}} catalogue={{ voices: [], loading: false, unavailable: true, refresh: () => {} }} /> };
