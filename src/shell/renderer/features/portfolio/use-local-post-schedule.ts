import { useCallback, useEffect, useState } from 'react';
import { loadLocalPostSchedule, type LocalPostScheduleRecord } from './local-post-schedule-store.js';

// @nimi-authority: rule.realm-persona-studio.failure.r001
export function useLocalPostSchedule(personaId: string, disabled = false) {
  const [schedule, setSchedule] = useState<LocalPostScheduleRecord | null>(null);
  const [loading, setLoading] = useState(!disabled);
  const [unavailable, setUnavailable] = useState(false);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((current) => current + 1), []);

  useEffect(() => {
    let cancelled = false;
    setSchedule(null);
    setUnavailable(false);
    setLoading(!disabled);
    if (disabled) return;
    void loadLocalPostSchedule(personaId).then((record) => {
      if (!cancelled) setSchedule(record);
    }).catch(() => {
      if (!cancelled) setUnavailable(true);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [personaId, disabled, revision]);

  return { schedule, setSchedule, loading, unavailable, reload };
}
