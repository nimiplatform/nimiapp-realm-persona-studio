import { defineConfig } from 'vite';
import path from 'node:path';
import { createRequire } from 'node:module';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const require = createRequire(import.meta.url);

function isNimiSdkModule(normalizedId: string): boolean {
  return (
    normalizedId.includes('/node_modules/@nimiplatform/sdk/')
    || normalizedId.includes('/node_modules/.pnpm/@nimiplatform+sdk@')
  );
}

function isNimiKitModule(normalizedId: string): boolean {
  return (
    normalizedId.includes('/node_modules/@nimiplatform/kit/')
    || normalizedId.includes('/node_modules/.pnpm/@nimiplatform+kit@')
  );
}

function isNodePackage(normalizedId: string, packageName: string): boolean {
  return (
    normalizedId.includes(`/node_modules/.pnpm/${packageName}@`)
    || normalizedId.includes(`/node_modules/${packageName}/`)
  );
}

export default defineConfig(() => {
  return {
    root: path.resolve(__dirname, 'src/shell/renderer'),
    envDir: __dirname,
    envPrefix: ['VITE_', 'NIMI_'],
    define: {
      'globalThis.__NIMI_IMPORT_META_ENV__': 'import.meta.env',
      'import.meta.env.VITE_NIMI_SHELL_MODE': JSON.stringify('realm-persona-studio'),
    },
    publicDir: false as const,
    resolve: {
      dedupe: [
        'react',
        'react-dom',
        'react-i18next',
        'react-router-dom',
        'scheduler',
        'zustand',
        '@nimiplatform/sdk',
      ],
      alias: [
        { find: 'react/jsx-dev-runtime', replacement: path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime.js') },
        { find: 'react/jsx-runtime', replacement: path.resolve(__dirname, 'node_modules/react/jsx-runtime.js') },
        { find: 'react-dom/client', replacement: path.resolve(__dirname, 'node_modules/react-dom/client.js') },
        { find: 'react-dom', replacement: path.resolve(__dirname, 'node_modules/react-dom/index.js') },
        { find: 'react', replacement: path.resolve(__dirname, 'node_modules/react/index.js') },
        { find: 'scheduler', replacement: require.resolve('scheduler') },
        { find: '@renderer', replacement: path.resolve(__dirname, 'src/shell/renderer') },
      ],
    },
    plugins: [react(), tailwindcss()],
    optimizeDeps: {
      // Nimi workspace packages are local authority surfaces during app
      // development. Pre-bundling them creates a stale third truth after
      // Runtime/SDK/kit hard cuts, so only stable external packages are
      // warmed in Vite's optimized dependency cache.
      include: [
        '@tanstack/react-query',
        'react-router-dom',
        'zustand',
        'lucide-react',
      ],
      exclude: [
        '@nimiplatform/kit',
        '@nimiplatform/kit/ui',
        '@nimiplatform/kit/auth',
        '@nimiplatform/kit/features/model-config',
        '@nimiplatform/kit/features/model-config/headless',
        '@nimiplatform/kit/features/model-picker/runtime',
        '@nimiplatform/kit/features/model-picker/ui',
        '@nimiplatform/kit/shell/renderer/bootstrap',
        '@nimiplatform/kit/shell/renderer/bridge',
        '@nimiplatform/kit/telemetry/error-boundary',
        '@nimiplatform/sdk',
        '@nimiplatform/sdk/ai',
        '@nimiplatform/sdk/contracts',
        '@nimiplatform/sdk/features/conversation',
        '@nimiplatform/sdk/realm',
        '@nimiplatform/sdk/realm/generated',
        '@nimiplatform/sdk/runtime',
        '@nimiplatform/sdk/runtime/generated',
        '@nimiplatform/sdk/types',
      ],
    },
    server: {
      host: '127.0.0.1',
      port: 1450,
      strictPort: true,
    },
    build: {
      outDir: path.resolve(__dirname, 'dist'),
      emptyOutDir: true,
      sourcemap: true,
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'src/shell/renderer/index.html'),
        },
        output: {
          manualChunks(id) {
            const normalizedId = id.split(path.sep).join('/');

            if (isNimiSdkModule(normalizedId)) {
              if (
                normalizedId.includes('/runtime/generated/')
                || normalizedId.includes('/core-generated/runtime-protobuf/')
              ) return 'sdk-runtime-generated';
              if (
                normalizedId.includes('/realm/generated/')
                || normalizedId.includes('/core-generated/realm-protobuf/')
              ) return 'sdk-realm-generated';
              return 'sdk-client';
            }
            if (isNimiKitModule(normalizedId)) {
              return 'vendor-platform';
            }
            if (!normalizedId.includes('node_modules')) {
              return undefined;
            }
            if (
              isNodePackage(normalizedId, 'react')
              || isNodePackage(normalizedId, 'react-dom')
              || isNodePackage(normalizedId, 'scheduler')
              || isNodePackage(normalizedId, 'use-sync-external-store')
            ) {
              return 'vendor-react';
            }
            if (
              isNodePackage(normalizedId, 'react-router-dom')
              || isNodePackage(normalizedId, 'react-router')
              || isNodePackage(normalizedId, '@remix-run/router')
            ) {
              return 'vendor-router';
            }
            if (
              isNodePackage(normalizedId, '@tanstack/react-query')
              || isNodePackage(normalizedId, '@tanstack/query-core')
            ) {
              return 'vendor-query';
            }
            if (isNodePackage(normalizedId, 'zustand')) {
              return 'vendor-state';
            }
            if (
              isNodePackage(normalizedId, 'i18next')
              || isNodePackage(normalizedId, 'react-i18next')
            ) {
              return 'vendor-i18n';
            }
            if (isNodePackage(normalizedId, '@tauri-apps/api')) {
              return 'vendor-tauri';
            }
            if (isNodePackage(normalizedId, 'lucide-react')) {
              return 'vendor-icons';
            }
            return 'vendor-misc';
          },
        },
      },
    },
  };
});
