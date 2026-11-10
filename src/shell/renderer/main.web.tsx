import { createWebNimiAppSession, type NimiRemoteAppConfig } from '@nimiplatform/kit/auth/app/web';
import { mountStudio } from './mount-studio.js';
declare const __NIMI_APP_WEB_CONFIG__: NimiRemoteAppConfig;
const dispose = mountStudio(createWebNimiAppSession(__NIMI_APP_WEB_CONFIG__));
if (import.meta.hot) import.meta.hot.dispose(dispose);
