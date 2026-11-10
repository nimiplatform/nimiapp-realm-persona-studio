import { useStudioScope } from './studio-scope.js';
import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { useBlocker } from 'react-router-dom';
import { ConfirmDialog } from '@nimiplatform/kit/ui';
import { useStudioI18n } from '../i18n/use-studio-i18n.js';

type Guard = { source: 'post' | 'profile'; dirty: boolean; pending: boolean };
type GuardRegistry = { update: (id: string, guard: Guard | null) => void; requestLeave: (action: () => void) => void };
const NavigationGuardContext = createContext<GuardRegistry | null>(null);

/** One router blocker for all open forms, including a profile dialog over a post editor. */
export function StudioNavigationGuardProvider({ children }: { children: ReactNode }) {
  const { t } = useStudioI18n();
  const scope = useStudioScope();
  const [exitAction, setExitAction] = useState<(() => void) | null>(null);
  const [guards, setGuards] = useState<ReadonlyMap<string, Guard>>(new Map());
  const update = useCallback((id: string, guard: Guard | null) => {
    setGuards((current) => {
      const previous = current.get(id);
      if (!guard || (!guard.dirty && !guard.pending)) {
        if (!previous) return current;
        const next = new Map(current); next.delete(id); return next;
      }
      if (previous?.dirty === guard.dirty && previous.pending === guard.pending && previous.source === guard.source) return current;
      return new Map(current).set(id, guard);
    });
  }, []);

  const dirty = [...guards.values()].filter((guard) => guard.dirty);
  const pending = [...guards.values()].some((guard) => guard.pending);
  const hasUnsaved = dirty.length > 0;
  const requestLeave = useCallback((action: () => void) => {
    if (scope.signal.aborted) return;
    if (hasUnsaved || pending) setExitAction(() => action); else action();
  }, [scope, hasUnsaved, pending]);
  const registry = useMemo(() => ({ update, requestLeave }), [update, requestLeave]);
  const blocker = useBlocker(hasUnsaved || pending);
  useEffect(() => {
    if (!hasUnsaved && !pending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsaved, pending]);
  useEffect(() => {
    if (blocker.state === 'blocked' && !hasUnsaved && !pending) blocker.proceed();
  }, [blocker, hasUnsaved, pending]);
  useEffect(() => { if (exitAction && !hasUnsaved && !pending && !scope.signal.aborted) { setExitAction(null); exitAction(); } }, [exitAction, hasUnsaved, pending, scope]);
  const onlyPost = dirty.length === 1 && dirty[0]?.source === 'post';
  const message = dirty.length > 1 ? 'shell.navigation.unsavedMultiple'
    : onlyPost ? 'posts.workspace.discardDescription' : 'persona.settings.discardDescription';
  return <NavigationGuardContext.Provider value={registry}>
    {children}
    <ConfirmDialog open={blocker.state === 'blocked' || exitAction !== null}
      title={t(onlyPost ? 'posts.workspace.discardTitle' : 'persona.settings.discardTitle')} message={t(message)}
      confirmLabel={t('persona.settings.discardConfirm')} cancelLabel={t('common.cancel')} confirmTone="danger" loading={pending}
      onConfirm={() => { if (pending || scope.signal.aborted) return; if (exitAction) { setExitAction(null); exitAction(); } else if (blocker.state === 'blocked') blocker.proceed(); }}
      onClose={() => { if (pending) return; setExitAction(null); if (blocker.state === 'blocked') blocker.reset(); }} />
  </NavigationGuardContext.Provider>;
}

export function useStudioNavigationGuard(source: Guard['source'], dirty: boolean, pending: boolean) {
  const registry = useContext(NavigationGuardContext);
  const id = useId();
  if (!registry) throw new Error('StudioNavigationGuardProvider is required for editable Studio forms.');
  const { update } = registry;
  useLayoutEffect(() => {
    update(id, { source, dirty, pending });
    return () => update(id, null);
  }, [update, id, source, dirty, pending]);
}

export function useStudioLeaveRequest() {
  const registry = useContext(NavigationGuardContext);
  if (!registry) throw new Error('StudioNavigationGuardProvider is required.');
  return registry.requestLeave;
}
