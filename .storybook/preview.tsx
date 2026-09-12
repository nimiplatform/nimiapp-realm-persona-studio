import type { Preview } from '@storybook/react-vite';
import { NimiThemeProvider, NimiToaster, TooltipProvider } from '@nimiplatform/kit/ui';
import { ensureStudioI18nInitialized } from '../src/shell/renderer/i18n/studio-i18n.js';
import '../src/shell/renderer/styles.css';

const preview: Preview = {
  parameters: { layout: 'fullscreen' },
  globalTypes: {
    locale: { toolbar: { title: 'Language', items: ['zh', 'en'] } },
    scheme: { toolbar: { title: 'Theme', items: ['light', 'dark'] } },
  },
  initialGlobals: { locale: 'zh', scheme: 'light' },
  loaders: [async ({ globals }) => {
    await ensureStudioI18nInitialized().changeLanguage(globals.locale);
    return {};
  }],
  decorators: [(Story, { globals }) => (
    <NimiThemeProvider key={globals.scheme} accentPack="nimi-accent" defaultScheme={globals.scheme} defaultDensity="compact">
      <TooltipProvider><Story /><NimiToaster /></TooltipProvider>
    </NimiThemeProvider>
  )],
};
export default preview;
