import { installNimiShellRuntimeBridge } from '@nimiplatform/kit/shell/renderer/bridge';
import { createDesktopNimiAppSession } from '@nimiplatform/kit/auth/app/desktop';
import { mountStudio } from './mount-studio.js';
installNimiShellRuntimeBridge();
const dispose = mountStudio(createDesktopNimiAppSession());
if (import.meta.hot) import.meta.hot.dispose(dispose);
