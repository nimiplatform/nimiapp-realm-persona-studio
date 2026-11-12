import type { NimiRemoteAppConfig } from '@nimiplatform/kit/core/app-session';
import { createMobileNimiAppSession } from '@nimiplatform/kit/auth/app/mobile';
import { mountStudio } from './mount-studio.js';
declare const __NIMI_APP_MOBILE_CONFIG__: NimiRemoteAppConfig;
// @nimi-authority: rule.realm-persona-studio.core.r015
const dispose = mountStudio(createMobileNimiAppSession(__NIMI_APP_MOBILE_CONFIG__));
if (import.meta.hot) import.meta.hot.dispose(dispose);
