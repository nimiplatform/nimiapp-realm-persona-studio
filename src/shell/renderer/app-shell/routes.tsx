import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Surface } from '@nimiplatform/kit/ui';
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
const PersonaDetailPage = lazy(() =>
  import('../features/persona-detail/persona-detail-page.js').then((m) => ({ default: m.PersonaDetailPage })),
);
const PersonaSettingsPage = lazy(() =>
  import('../features/persona-settings/persona-settings-page.js').then((m) => ({ default: m.PersonaSettingsPage })),
);
const PersonaSettingsReviewPage = lazy(() =>
  import('../features/persona-settings-review/persona-settings-review-page.js').then((m) => ({
    default: m.PersonaSettingsReviewPage,
  })),
);
const PersonaAssetsPage = lazy(() =>
  import('../features/persona-assets/persona-assets-page.js').then((m) => ({ default: m.PersonaAssetsPage })),
);
const PersonaPostsPage = lazy(() =>
  import('../features/persona-posts/persona-posts-page.js').then((m) => ({ default: m.PersonaPostsPage })),
);
const PersonaPostsSchedulePage = lazy(() =>
  import('../features/persona-posts-schedule/persona-posts-schedule-page.js').then((m) => ({
    default: m.PersonaPostsSchedulePage,
  })),
);
const PersonaContentManagementPage = lazy(() =>
  import('../features/persona-content-management/persona-content-management-page.js').then((m) => ({
    default: m.PersonaContentManagementPage,
  })),
);
const PersonaVoiceConfigPage = lazy(() =>
  import('../features/persona-voice/persona-voice-config-page.js').then((m) => ({
    default: m.PersonaVoiceConfigPage,
  })),
);
const PersonaPublicPreviewPage = lazy(() =>
  import('../features/persona-preview/persona-public-preview-page.js').then((m) => ({
    default: m.PersonaPublicPreviewPage,
  })),
);
const PersonaLaunchPage = lazy(() =>
  import('../features/persona-launch/persona-launch-page.js').then((m) => ({ default: m.PersonaLaunchPage })),
);
const PersonaInsightsPage = lazy(() =>
  import('../features/persona-insights/persona-insights-page.js').then((m) => ({ default: m.PersonaInsightsPage })),
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
    <Surface tone="canvas" padding="none" className="flex h-full items-center justify-center border-0 ras-text-muted">
      {t('common.loadingEllipsis')}
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
            <Route path="/portfolio/:personaId" element={<PersonaDetailPage />} />
            <Route path="/portfolio/:personaId/settings" element={<PersonaSettingsPage />} />
            <Route path="/portfolio/:personaId/settings/review" element={<PersonaSettingsReviewPage />} />
            <Route path="/portfolio/:personaId/assets" element={<PersonaAssetsPage />} />
            <Route path="/portfolio/:personaId/assets/voice" element={<PersonaVoiceConfigPage />} />
            <Route path="/portfolio/:personaId/posts" element={<PersonaPostsPage />} />
            <Route path="/portfolio/:personaId/posts/schedule" element={<PersonaPostsSchedulePage />} />
            <Route path="/portfolio/:personaId/posts/manage" element={<PersonaContentManagementPage />} />
            <Route path="/portfolio/:personaId/preview" element={<PersonaPublicPreviewPage />} />
            <Route path="/portfolio/:personaId/launch" element={<PersonaLaunchPage />} />
            <Route path="/portfolio/:personaId/insights" element={<PersonaInsightsPage />} />
            <Route path="/assets" element={<AssetsLibraryPage />} />
            <Route path="/ai-config" element={<StudioAIConfigPage />} />
            <Route path="*" element={<Navigate to="/portfolio" replace />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </Suspense>
  );
}
