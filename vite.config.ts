import { defineConfig } from 'vite';
import path from 'node:path';
import { createRequire } from 'node:module';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const require = createRequire(import.meta.url);
const nimiRepoRoot = path.resolve(__dirname, '../../nimi');
const nimiSdkSourceRoot = path.resolve(nimiRepoRoot, 'sdks/typescript');
const nimiKitSourceRoot = path.resolve(nimiRepoRoot, 'kit');

function isNimiSdkModule(normalizedId: string): boolean {
  return (
    normalizedId.includes('/node_modules/@nimiplatform/sdk/')
    || normalizedId.includes('/node_modules/.pnpm/@nimiplatform+sdk@')
    || normalizedId.includes('/nimi-realm/nimi/sdks/typescript/')
  );
}

function isNimiKitModule(normalizedId: string): boolean {
  return (
    normalizedId.includes('/node_modules/@nimiplatform/kit/')
    || normalizedId.includes('/node_modules/.pnpm/@nimiplatform+kit@')
    || normalizedId.includes('/nimi-realm/nimi/kit/')
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
        { find: '@tauri-apps/api/core', replacement: path.resolve(__dirname, 'node_modules/@tauri-apps/api/core.js') },
        { find: /^@nimiplatform\/sdk$/, replacement: path.resolve(nimiSdkSourceRoot, 'index.ts') },
        { find: /^@nimiplatform\/sdk\/ai$/, replacement: path.resolve(nimiSdkSourceRoot, 'core/ai/index.ts') },
        { find: /^@nimiplatform\/sdk\/contracts$/, replacement: path.resolve(nimiSdkSourceRoot, 'core/contracts/index.ts') },
        { find: /^@nimiplatform\/sdk\/features\/conversation$/, replacement: path.resolve(nimiSdkSourceRoot, 'features/conversation/index.ts') },
        { find: /^@nimiplatform\/sdk\/realm$/, replacement: path.resolve(nimiSdkSourceRoot, 'realm/index.ts') },
        { find: /^@nimiplatform\/sdk\/realm\/generated$/, replacement: path.resolve(nimiSdkSourceRoot, 'realm/generated.ts') },
        { find: /^@nimiplatform\/sdk\/runtime$/, replacement: path.resolve(nimiSdkSourceRoot, 'runtime/index.ts') },
        { find: /^@nimiplatform\/sdk\/runtime\/generated$/, replacement: path.resolve(nimiSdkSourceRoot, 'runtime/generated.ts') },
        { find: /^@nimiplatform\/sdk\/types$/, replacement: path.resolve(nimiSdkSourceRoot, 'types/index.ts') },
        { find: /^@nimiplatform\/kit\/auth$/, replacement: path.resolve(nimiKitSourceRoot, 'auth/src/index.ts') },
        { find: /^@nimiplatform\/kit\/auth\/styles\.css$/, replacement: path.resolve(nimiKitSourceRoot, 'auth/src/styles.css') },
        { find: /^@nimiplatform\/kit\/core\/model-config$/, replacement: path.resolve(nimiKitSourceRoot, 'core/src/model-config/index.ts') },
        { find: /^@nimiplatform\/kit\/core\/oauth$/, replacement: path.resolve(nimiKitSourceRoot, 'core/src/oauth/index.ts') },
        { find: /^@nimiplatform\/kit\/core\/sdk-contract$/, replacement: path.resolve(nimiKitSourceRoot, 'core/src/sdk-contract.ts') },
        { find: /^@nimiplatform\/kit\/core\/storage-json$/, replacement: path.resolve(nimiKitSourceRoot, 'core/src/storage-json.ts') },
        { find: /^@nimiplatform\/kit\/features\/model-config$/, replacement: path.resolve(nimiKitSourceRoot, 'features/model-config/src/index.ts') },
        { find: /^@nimiplatform\/kit\/features\/model-config\/headless$/, replacement: path.resolve(nimiKitSourceRoot, 'features/model-config/src/headless.ts') },
        { find: /^@nimiplatform\/kit\/features\/model-picker\/runtime$/, replacement: path.resolve(nimiKitSourceRoot, 'features/model-picker/src/runtime.ts') },
        { find: /^@nimiplatform\/kit\/features\/model-picker\/ui$/, replacement: path.resolve(nimiKitSourceRoot, 'features/model-picker/src/ui.ts') },
        { find: /^@nimiplatform\/kit\/shell\/renderer\/bootstrap$/, replacement: path.resolve(nimiKitSourceRoot, 'shell/renderer/src/bootstrap/index.ts') },
        { find: /^@nimiplatform\/kit\/shell\/renderer\/bridge$/, replacement: path.resolve(nimiKitSourceRoot, 'shell/renderer/src/bridge/index.ts') },
        { find: /^@nimiplatform\/kit\/telemetry\/error-boundary$/, replacement: path.resolve(nimiKitSourceRoot, 'telemetry/src/error-boundary/index.ts') },
        { find: /^@nimiplatform\/kit\/ui$/, replacement: path.resolve(nimiKitSourceRoot, 'ui/src/index.ts') },
        { find: /^@nimiplatform\/kit\/ui\/styles\.css$/, replacement: path.resolve(nimiKitSourceRoot, 'ui/src/styles.css') },
        { find: /^@nimiplatform\/kit\/ui\/themes\/(.+\.css)$/, replacement: path.resolve(nimiKitSourceRoot, 'ui/src/themes/$1') },
        { find: /^@nimiplatform\/kit\/ui\/(.+)$/, replacement: path.resolve(nimiKitSourceRoot, 'ui/src/$1') },
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
      fs: {
        allow: [
          path.resolve(__dirname),
          nimiRepoRoot,
        ],
      },
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
