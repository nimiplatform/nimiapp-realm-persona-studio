import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LoadingSkeleton, Surface } from '@nimiplatform/kit/ui';
import {
  AnimatePresence,
  motion,
  resolveMotionDurationMs,
  useNimiReducedMotion,
} from '@nimiplatform/kit/ui/motion';
import { useStudioI18n } from '../i18n/use-studio-i18n.js';
import { PersonaListPage } from '../features/persona-list/persona-list-page.js';

const PersonaCreatePage = lazy(() =>
  import('../features/persona-create/persona-create-page.js').then((m) => ({ default: m.PersonaCreatePage })),
);
const PersonaOverviewPage = lazy(() =>
  import('../features/persona-overview/persona-overview-page.js').then((m) => ({ default: m.PersonaOverviewPage })),
);
const PersonaSettingsPage = lazy(() =>
  import('../features/persona-settings/persona-settings-page.js').then((m) => ({ default: m.PersonaSettingsPage })),
);
const PersonaIdentityPage = lazy(() =>
  import('../features/persona-identity/persona-identity-page.js').then((m) => ({ default: m.PersonaIdentityPage })),
);
const PersonaPostsPage = lazy(() =>
  import('../features/persona-posts/persona-posts-page.js').then((m) => ({ default: m.PersonaPostsPage })),
);
const PersonaContentManagementPage = lazy(() =>
  import('../features/persona-content-management/persona-content-management-page.js').then((m) => ({
    default: m.PersonaContentManagementPage,
  })),
);
const StudioAIConfigPage = lazy(() =>
  import('../features/ai-config/studio-ai-config-page.js').then((m) => ({ default: m.StudioAIConfigPage })),
);
const AssetsLibraryPage = lazy(() =>
  import('../features/assets-library/assets-library-page.js').then((m) => ({ default: m.AssetsLibraryPage })),
);

function PageFallback() {
  const { t } = useStudioI18n();
  return (
    <Surface tone="canvas" padding="lg" className="flex h-full items-center justify-center border-0">
      <LoadingSkeleton lines={3} label={t('common.loadingEllipsis')} className="w-full max-w-md" />
    </Surface>
  );
}

/* Page-transition vocabulary mirrors Nimi Desktop's panel motion: rise + deblur
 * on enter (base/emphasized), sink on exit (fast). Values mirror the spec-owned
 * motion tokens (`NIMI_MOTION_EASINGS.emphasized` as a cubic-bezier array). */
const EMPHASIZED_EASE: [number, number, number, number] = [0.05, 0.7, 0.1, 1];

export function AppRoutes() {
  const location = useLocation();
  const reducedMotion = useNimiReducedMotion();
  const enterDuration = resolveMotionDurationMs('base', reducedMotion) / 1000;
  const exitDuration = resolveMotionDurationMs('fast', reducedMotion) / 1000;

  return (
    <Suspense fallback={<PageFallback />}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={location.pathname}
          className="flex min-h-0 w-full flex-1 flex-col"
          initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
          animate={{
            opacity: 1,
            y: 0,
            filter: 'blur(0px)',
            transition: { duration: enterDuration, ease: EMPHASIZED_EASE },
          }}
          exit={{
            opacity: 0,
            y: -6,
            filter: 'blur(4px)',
            transition: { duration: exitDuration, ease: EMPHASIZED_EASE },
          }}
        >
          <Routes location={location}>
            <Route path="/portfolio" element={<PersonaListPage />} />
            <Route path="/portfolio/create" element={<PersonaCreatePage />} />
            <Route path="/portfolio/:personaId" element={<PersonaOverviewPage />} />
            <Route path="/portfolio/:personaId/settings" element={<PersonaSettingsPage />} />
            <Route path="/portfolio/:personaId/identity" element={<PersonaIdentityPage />} />
            <Route path="/portfolio/:personaId/posts" element={<PersonaPostsPage />} />
            <Route path="/portfolio/:personaId/posts/manage" element={<PersonaContentManagementPage />} />
            <Route path="/assets" element={<AssetsLibraryPage />} />
            <Route path="/ai-config" element={<StudioAIConfigPage />} />
            <Route path="*" element={<Navigate to="/portfolio" replace />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </Suspense>
  );
}
