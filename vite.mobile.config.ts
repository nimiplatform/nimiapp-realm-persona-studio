import { defineConfig, mergeConfig } from 'vite';
import path from 'node:path';
import base from './vite.config.js';
import { mobileAccess } from './capacitor.config';

export default defineConfig(async environment => {
  const config = typeof base === 'function' ? await base(environment) : await base;
  return mergeConfig(config, {
    envPrefix: ['VITE_'],
    plugins: [{ name: 'studio-mobile-entry', transformIndexHtml: { order: 'pre', handler: (html: string) => html.replace('/main.tsx', '/main.mobile.tsx') } }],
    define: { __NIMI_APP_MOBILE_CONFIG__: JSON.stringify(mobileAccess) },
    build: { outDir: path.resolve(import.meta.dirname, 'dist-mobile') },
  });
});
