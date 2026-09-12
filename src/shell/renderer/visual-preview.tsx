import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { NimiThemeProvider, NimiToaster, TooltipProvider } from '@nimiplatform/kit/ui';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import { PersonaVisualPreviewProvider } from './features/persona-detail/persona-visual-preview-context.js';
import { PERSONA_WORKSPACE_VISUAL_FIXTURE_DATA, PERSONA_WORKSPACE_VISUAL_FIXTURE_DETAILS } from './features/persona-detail/persona-workspace.visual-fixture.js';
import { studioQueryClient } from './infra/query-client.js';
import { PreviewShell } from './visual-preview-app.js';
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('REALM_PERSONA_STUDIO_VISUAL_PREVIEW_ROOT_MISSING');

const previewGlobal = globalThis as typeof globalThis & {
  __RPS_VISUAL_PREVIEW_ROOT__?: Root;
};
const previewRoot = previewGlobal.__RPS_VISUAL_PREVIEW_ROOT__ ?? createRoot(rootElement);
previewGlobal.__RPS_VISUAL_PREVIEW_ROOT__ = previewRoot;

const previewRouter = createHashRouter([{ path: '*', element: <PersonaVisualPreviewProvider details={PERSONA_WORKSPACE_VISUAL_FIXTURE_DETAILS} visualData={PERSONA_WORKSPACE_VISUAL_FIXTURE_DATA}><PreviewShell /></PersonaVisualPreviewProvider> }]);

previewRoot.render(
  <StrictMode>
    <NimiThemeProvider accentPack="nimi-accent" defaultScheme="light" defaultDensity="compact">
      <QueryClientProvider client={studioQueryClient}>
        <TooltipProvider>
          <RouterProvider router={previewRouter} />
          <NimiToaster />
        </TooltipProvider>
      </QueryClientProvider>
    </NimiThemeProvider>
  </StrictMode>,
);
