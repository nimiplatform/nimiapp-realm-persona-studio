import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { PreviewShell } from '../src/shell/renderer/visual-preview-app.js';
import { studioQueryClient } from '../src/shell/renderer/infra/query-client.js';
import { PersonaVisualPreviewProvider } from '../src/shell/renderer/features/persona-detail/persona-visual-preview-context.js';
import { PERSONA_WORKSPACE_VISUAL_FIXTURE_DATA, PERSONA_WORKSPACE_VISUAL_FIXTURE_DETAILS } from '../src/shell/renderer/features/persona-detail/persona-workspace.visual-fixture.js';
import { configureSettingsFixture } from './settings-fixture.js';

// Presentation fixtures only. No protected bridge, account, AI execution, or Realm write is substituted.
function StudioPage({ path, settingsUnavailable = false }: { path: string; settingsUnavailable?: boolean }) {
  configureSettingsFixture(settingsUnavailable);
  const [router] = useState(() => createMemoryRouter([{
    path: '*',
    element: <PersonaVisualPreviewProvider details={PERSONA_WORKSPACE_VISUAL_FIXTURE_DETAILS} visualData={PERSONA_WORKSPACE_VISUAL_FIXTURE_DATA}><PreviewShell /></PersonaVisualPreviewProvider>,
  }], { initialEntries: [path] }));
  return <QueryClientProvider client={studioQueryClient}><RouterProvider router={router} /></QueryClientProvider>;
}
const meta = { title: 'Studio/Pages', component: StudioPage, render: (args) => <StudioPage key={args.path + String(args.settingsUnavailable)} {...args} /> } satisfies Meta<typeof StudioPage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Portfolio: Story = { args: { path: '/portfolio' } };
export const Create: Story = { args: { path: '/portfolio/create' } };
export const ReferenceSources: Story = { args: { path: '/preview/create-reference-sources' } };
export const Overview: Story = { args: { path: '/portfolio/visual-xiaomi' } };
export const Settings: Story = { args: { path: '/portfolio/visual-xiaomi/settings' } };
export const SettingsUnavailable: Story = { args: { path: '/portfolio/visual-xiaomi/settings', settingsUnavailable: true } };
export const Identity: Story = { args: { path: '/portfolio/visual-xiaomi/identity' } };
export const Posts: Story = { args: { path: '/portfolio/visual-xiaomi/posts' } };
export const ContentManagement: Story = { args: { path: '/portfolio/visual-xiaomi/posts/manage' } };
export const AssetsUnavailable: Story = { args: { path: '/assets' } };
export const AIConfigUnavailable: Story = { args: { path: '/ai-config' } };
