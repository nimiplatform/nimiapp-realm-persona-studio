import { defineConfig, loadEnv, mergeConfig } from 'vite';
import path from 'node:path';
import { nimiWebViteConfig } from '@nimiplatform/app-tools/web';
import base from './vite.config.js';

export default defineConfig(async environment => {
  const config = typeof base === 'function' ? await base(environment) : await base;
  return mergeConfig(mergeConfig(config, {
    envPrefix: ['VITE_'],
    plugins: [{ name: 'persona-studio-web-entry', transformIndexHtml: { order: 'pre', handler: (html: string) => html.replace('/main.tsx', '/main.web.tsx') } }],
    build: { outDir: path.resolve(import.meta.dirname, 'dist-web') },
  }), nimiWebViteConfig({
    root: import.meta.dirname,
    env: { ...loadEnv(environment.mode, import.meta.dirname, ''), ...process.env },
    serve: environment.command === 'serve',
    release: environment.mode === 'web-release',
  }));
});
