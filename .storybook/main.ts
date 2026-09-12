import type { StorybookConfig } from '@storybook/react-vite';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';

const config: StorybookConfig = {
  stories: ['./*.stories.tsx'],
  framework: { name: '@storybook/react-vite', options: { builder: { viteConfigPath: false } } },
  core: { disableTelemetry: true },
  async viteFinal(config) {
    return {
      ...config,
      plugins: [...(config.plugins ?? []), tailwindcss()],
      define: {
        ...config.define,
        'globalThis.__NIMI_IMPORT_META_ENV__': 'import.meta.env',
        'import.meta.env.VITE_NIMI_SHELL_MODE': JSON.stringify('realm-persona-studio'),
      },
      resolve: {
        ...config.resolve,
        dedupe: ['react', 'react-dom', 'react-router-dom', 'react-i18next', 'scheduler', 'zustand'],
        alias: [
          { find: './portfolio-settings-client.js', replacement: path.resolve(import.meta.dirname, 'settings-fixture.ts') },
          { find: '@renderer', replacement: path.resolve(import.meta.dirname, '../src/shell/renderer') },
        ],
      },
    };
  },
};
export default config;
